//! Counting the tokens of the part of a transcript written before Heron
//! followed it, on a thread of its own: a long session's file can be
//! hundreds of MB, and the poll must not wait for it.

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver};
use std::thread;

use log::debug;
use serde_json::Value;

use super::tokens::{answer_usage, Usage};

/// The answers in the first `upto` bytes of `path`, by message id. The
/// receiver gets nothing if the file cannot be read.
pub fn spawn(path: PathBuf, upto: u64) -> Receiver<HashMap<String, Usage>> {
    let (tx, rx) = mpsc::channel();
    let spawned = thread::Builder::new().name("token-scan".into()).spawn(move || {
        if let Ok(answers) = count(&path, upto) {
            debug!("agent: counted {} earlier answers in {}", answers.len(), path.display());
            let _ = tx.send(answers);
        }
    });
    if let Err(err) = spawned {
        log::warn!("agent: token scan thread failed to start: {err}");
    }
    rx
}

fn count(path: &PathBuf, upto: u64) -> std::io::Result<HashMap<String, Usage>> {
    let mut answers = HashMap::new();
    for line in BufReader::new(File::open(path)?.take(upto)).lines() {
        // Only answer lines carry a usage; most other lines are skipped unparsed.
        let Ok(line) = line else { continue };
        if !line.contains("\"usage\"") {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<Value>(&line) else { continue };
        if let Some((id, usage)) = answer_usage(&entry) {
            answers.insert(id, usage);
        }
    }
    Ok(answers)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_only_the_part_before_upto() {
        let path = std::env::temp_dir().join(format!("heron-token-scan-{}.jsonl", std::process::id()));
        let line = |id: &str, out: u64| {
            format!(r#"{{"type":"assistant","message":{{"id":"{id}","usage":{{"output_tokens":{out}}}}}}}"#) + "\n"
        };
        let first = line("m1", 5) + &line("m1", 9) + r#"{"type":"user","message":{"content":"hi"}}"# + "\n";
        std::fs::write(&path, first.clone() + &line("m2", 100)).unwrap();
        let answers = spawn(path.clone(), first.len() as u64).recv().unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_eq!(answers.len(), 1);
        assert_eq!(answers["m1"].output, 9, "the last usage of an answer");
    }
}

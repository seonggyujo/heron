//! Tests for transcript.rs: new complete lines only, answers once each, conversation entries only.

use super::*;
use std::io::Write;

fn answer(id: &str, model: &str, timestamp: &str) -> String {
    format!(r#"{{"type":"assistant","timestamp":"{timestamp}","message":{{"id":"{id}","model":"{model}"}}}}"#) + "\n"
}

fn append(path: &Path, text: &str) {
    std::fs::OpenOptions::new().create(true).append(true).open(path).unwrap().write_all(text.as_bytes()).unwrap();
}

#[test]
fn reads_only_new_complete_answers_once_each() {
    let path = std::env::temp_dir().join(format!("heron-transcript-{}.jsonl", std::process::id()));
    let _ = std::fs::remove_file(&path);
    append(&path, &answer("old", "claude-sonnet-5-5", "2099-01-01T00:00:00Z"));
    let mut transcript = Transcript::follow(path.clone());
    assert!(transcript.read_new().answers.is_empty(), "answers already there are not judged");

    let now = "2099-01-01T00:00:01Z";
    let split = answer("a", "claude-opus-5-5", now);
    append(&path, &(split.clone() + &split + &split[..10]));
    let news = transcript.read_new();
    assert_eq!(news.answers.len(), 1, "lines of one answer count once");
    assert_eq!(news.answers[0].model, "claude-opus-5-5");
    assert_eq!(news.entries.len(), 2, "every line is an entry");

    append(&path, &split[10..]);
    assert!(transcript.read_new().answers.is_empty(), "the finished line was the same answer");

    // A copy of an older answer, as a forked session writes it, and a
    // line that is not JSON.
    append(&path, &(answer("copy", "claude-sonnet-5-5", "2000-01-01T00:00:00Z") + "{\"type\":\"user\",\n"));
    append(&path, &answer("b", "claude-haiku-5-5", now));
    let news = transcript.read_new();
    assert_eq!(news.answers.iter().map(|a| a.model.as_str()).collect::<Vec<_>>(), ["claude-haiku-5-5"]);
    assert_eq!(news.entries.len(), 1);
    std::fs::remove_file(&path).unwrap();
}

#[test]
fn keeps_conversation_entries_only() {
    assert!(conversation_entry(r#"{"type":"user","message":{"content":"hi"}}"#).is_some());
    assert!(conversation_entry(r#"{"type":"file-history-snapshot","note":"\"user\""}"#).is_none());
    assert!(conversation_entry(r#"{"type":"summary"}"#).is_none());
}

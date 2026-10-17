//! Follows one Claude Code transcript while it grows: each read returns the
//! conversation entries (user and assistant) in the complete lines added
//! since the last read, and the answers among them once each. It starts at
//! the end of the file, and skips entries written before it started (a
//! forked or continued session begins with copies of older ones): the model
//! selected for those answers is unknown, and the work they show is over.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::answers::{answer_of, Answer};
use super::timestamps::entry_time;
use crate::epoch;

/// More new bytes than this between two reads: start over at the end.
const MAX_NEW_BYTES: u64 = 16 * 1024 * 1024;

pub struct Transcript {
    path: PathBuf,
    offset: u64,
    /// When following began, in ms since the Unix epoch.
    since: u64,
    last_id: Option<String>,
}

/// What one read found, oldest first.
#[derive(Default)]
pub struct News {
    pub entries: Vec<Value>,
    /// One per response.
    pub answers: Vec<Answer>,
}

impl Transcript {
    pub fn follow(path: PathBuf) -> Self {
        let offset = size(&path).unwrap_or(0);
        Self { path, offset, since: epoch::now_millis(), last_id: None }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Where the next read starts: at first, the end the file had when following began.
    pub fn offset(&self) -> u64 {
        self.offset
    }

    /// A line still being written is left for the next read.
    pub fn read_new(&mut self) -> News {
        let mut news = News::default();
        let Some(size) = size(&self.path) else { return news };
        if size < self.offset || size - self.offset > MAX_NEW_BYTES {
            self.offset = size;
            return news;
        }
        if size == self.offset {
            return news;
        }
        let Ok(bytes) = read_range(&self.path, self.offset, size) else { return news };
        let Some(end) = bytes.iter().rposition(|&b| b == b'\n').map(|i| i + 1) else { return news };
        self.offset += end as u64;
        for line in String::from_utf8_lossy(&bytes[..end]).lines() {
            let Some(entry) = conversation_entry(line) else { continue };
            if entry_time(&entry).is_some_and(|at| at < self.since) {
                continue;
            }
            if let Some(answer) = answer_of(&entry) {
                if answer.id.is_none() || answer.id != self.last_id {
                    self.last_id.clone_from(&answer.id);
                    news.answers.push(answer);
                }
            }
            news.entries.push(entry);
        }
        news
    }
}

/// A user or assistant entry; other lines (snapshots, summaries) are mostly
/// skipped before parsing.
fn conversation_entry(line: &str) -> Option<Value> {
    if !line.contains("\"assistant\"") && !line.contains("\"user\"") {
        return None;
    }
    let entry: Value = serde_json::from_str(line).ok()?;
    matches!(entry.get("type")?.as_str()?, "assistant" | "user").then_some(entry)
}

fn size(path: &Path) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len())
}

fn read_range(path: &Path, from: u64, to: u64) -> std::io::Result<Vec<u8>> {
    let mut file = File::open(path)?;
    file.seek(SeekFrom::Start(from))?;
    let mut bytes = Vec::with_capacity((to - from) as usize);
    file.take(to - from).read_to_end(&mut bytes)?;
    Ok(bytes)
}

#[cfg(test)]
#[path = "transcript_tests.rs"]
mod tests;

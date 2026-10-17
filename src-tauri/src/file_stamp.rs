//! What tells that a file changed since it was last read (its size and last
//! write), for the caches of session summaries and new files' line counts.

use std::fs::Metadata;
use std::time::SystemTime;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FileStamp {
    pub len: u64,
    pub modified: SystemTime,
}

impl FileStamp {
    pub fn of(meta: &Metadata) -> Option<Self> {
        Some(Self { len: meta.len(), modified: meta.modified().ok()? })
    }
}

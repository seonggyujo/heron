//! Lines of the new (untracked) files, counted once per version of each
//! file: an agent's folder is asked every 15 s while it works, and most of
//! its new files do not change between two asks.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use super::numstat;
use crate::file_stamp::FileStamp;

/// New files bigger than this count without their lines.
const MAX_COUNTED_BYTES: u64 = 2 * 1024 * 1024;
/// Counts kept at most; past it the oldest answers are simply dropped.
const MAX_KEPT: usize = 4096;

static LINES: LazyLock<Mutex<HashMap<PathBuf, (FileStamp, u64)>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// The lines of `file`, 0 for a binary, big or unreadable one.
pub fn lines(file: &Path) -> u64 {
    let Some(stamp) = file.metadata().ok().filter(|m| m.is_file()).and_then(|m| FileStamp::of(&m)) else { return 0 };
    if let Some((seen, lines)) = LINES.lock().unwrap().get(file) {
        if *seen == stamp {
            return *lines;
        }
    }
    let lines = if stamp.len <= MAX_COUNTED_BYTES { count(file) } else { 0 };
    let mut kept = LINES.lock().unwrap();
    if kept.len() >= MAX_KEPT {
        kept.clear();
    }
    kept.insert(file.to_owned(), (stamp, lines));
    lines
}

fn count(file: &Path) -> u64 {
    std::fs::read(file).ok().and_then(|b| numstat::text_lines(&b)).unwrap_or(0)
}

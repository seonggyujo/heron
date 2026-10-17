//! Finding and removing the files agents write for a pane (their names:
//! file_names.rs): a closed pane's files, and leftovers of a run that did
//! not clean up.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use log::debug;

use super::file_names::{is_subagent_id, key, path, subagent_prefix, KINDS};

/// Files older than this are leftovers of a run that did not clean up.
const STALE_AFTER: Duration = Duration::from_secs(24 * 60 * 60);

pub fn remove_pane(dir: &Path, pty: u32) {
    for kind in KINDS {
        let file = path(dir, pty, kind);
        if fs::remove_file(&file).is_ok() {
            debug!("agent: removed {}", file.display());
        }
    }
    remove_subagents(dir, &key(pty));
}

/// The subagent files of pane `key`, with the id of each.
pub fn subagent_files(dir: &Path, key: &str) -> Vec<(String, PathBuf)> {
    let prefix = subagent_prefix(key);
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let id = name.strip_prefix(&prefix)?.strip_suffix(".json")?;
            is_subagent_id(id).then(|| (id.to_owned(), entry.path()))
        })
        .collect()
}

pub fn remove_subagents(dir: &Path, key: &str) {
    for (_, file) in subagent_files(dir, key) {
        if fs::remove_file(&file).is_ok() {
            debug!("agent: removed {}", file.display());
        }
    }
}

pub fn remove_stale(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let old = entry
            .metadata()
            .and_then(|m| m.modified())
            .is_ok_and(|t| now.duration_since(t).unwrap_or_default() > STALE_AFTER);
        if old && fs::remove_file(entry.path()).is_ok() {
            debug!("agent: removed stale {}", entry.path().display());
        }
    }
}

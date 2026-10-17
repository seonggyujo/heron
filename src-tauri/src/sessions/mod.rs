//! Claude Code's sessions on this PC, for the sidebar: the newest session
//! files under `<config folder>/projects/<project>/`, each read from its end
//! (summary.rs), and deleting one. Claude Code writes the title records again
//! on every prompt, so the end holds the latest. Sessions some Claude Code
//! runs now (live.rs) and sessions whose folder is gone are left out; a
//! file is read again only when it changed (cache.rs). Also which saved
//! sessions can be resumed after a restart.

mod cache;
mod live;
mod recycle;
mod summary;

use std::cmp::Reverse;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::claude_dir::config_dir;
use crate::epoch;
use crate::file_stamp::FileStamp;

/// Bytes read from the end of a session file.
const TAIL_BYTES: u64 = 256 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSession {
    /// A UUID (summary.rs), safe to type after `claude --resume`.
    pub id: String,
    /// The folder the session last ran in.
    pub cwd: String,
    pub title: String,
    /// Last write, in ms since 1970.
    pub modified: u64,
}

/// The `limit` most recently written sessions, newest first.
pub fn recent(limit: usize) -> Vec<RecentSession> {
    let Some(config) = config_dir() else { return Vec::new() };
    let running = live::running_ids(&config);
    let mut files: Vec<(PathBuf, FileStamp)> =
        session_files(&config).filter_map(|path| Some((path.clone(), FileStamp::of(&path.metadata().ok()?)?))).collect();
    files.sort_by_key(|(_, stamp)| Reverse(stamp.modified));
    cache::keep_only(files.iter().map(|(path, _)| path));
    files
        .into_iter()
        .filter(|(path, _)| !path.file_stem().and_then(|s| s.to_str()).is_some_and(|id| running.contains(id)))
        .filter_map(|(path, stamp)| read(&path, stamp))
        .take(limit)
        .collect()
}

/// Of `ids`, the sessions `claude --resume` can open: Claude Code saved
/// them (it writes a session's file at its first message) and no Claude
/// Code runs them now.
pub fn resumable(ids: &[String]) -> Vec<String> {
    let Some(config) = config_dir() else { return Vec::new() };
    let running = live::running_ids(&config);
    let saved: HashSet<String> =
        session_files(&config).filter_map(|path| Some(path.file_stem()?.to_str()?.to_owned())).collect();
    ids.iter().filter(|id| saved.contains(*id) && !running.contains(*id)).cloned().collect()
}

/// Moves a session to the Recycle Bin: its file and the folder beside it
/// (subagents, saved tool output). Refuses an unknown or a running session
/// with an error code for the frontend.
pub fn delete(id: &str) -> Result<(), &'static str> {
    let config = config_dir().ok_or("not-found")?;
    if !summary::is_session_id(id) {
        return Err("not-found");
    }
    if live::running_ids(&config).contains(id) {
        return Err("running");
    }
    let name = format!("{id}.jsonl");
    let file = session_files(&config).find(|path| path.file_name().is_some_and(|n| *n == *name)).ok_or("not-found")?;
    let folder = file.with_extension("");
    let paths = if folder.is_dir() { vec![file, folder] } else { vec![file] };
    recycle::to_recycle_bin(&paths).map_err(|e| {
        log::warn!("sessions: deleting {id} failed: {e}");
        "io"
    })?;
    log::info!("sessions: moved {id} to the Recycle Bin");
    Ok(())
}

/// `<project>/<id>.jsonl`; subagent files sit deeper.
fn session_files(config: &Path) -> impl Iterator<Item = PathBuf> {
    fs::read_dir(config.join("projects"))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|dir| fs::read_dir(dir.path()).ok())
        .flat_map(|entries| entries.flatten())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl"))
}

fn read(path: &Path, stamp: FileStamp) -> Option<RecentSession> {
    let id = path.file_stem()?.to_str()?;
    if !summary::is_session_id(id) {
        return None;
    }
    let summary = cache::summary(path, stamp, || summary::summarize(&tail(path).ok()?))?;
    if !Path::new(&summary.cwd).is_dir() {
        return None;
    }
    let modified = epoch::millis(stamp.modified);
    Some(RecentSession { id: id.to_owned(), cwd: summary.cwd, title: summary.title, modified })
}

/// The last TAIL_BYTES of the file. A character cut at the start only
/// spoils the first line, which summary.rs skips.
fn tail(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let len = file.metadata()?.len();
    file.seek(SeekFrom::Start(len.saturating_sub(TAIL_BYTES)))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

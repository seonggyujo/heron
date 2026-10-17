//! heron.exe run by Claude Code as a hook (`heron.exe --agent-hook`).
//! It writes what the hook event tells (records.rs) into the pane's files,
//! the ones agent/ watches (state, model, one file per running subagent),
//! and exits. It prints nothing, because the output of some hooks is added
//! to the conversation. Outside a Heron pane it exits before reading
//! anything.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::Value;

use super::records::{model_record, state_record, subagent_change, SubagentChange};
use super::write_atomic;
use crate::agent::{is_pane_key, is_subagent_id, pane_file, remove_subagents, subagent_path, FileKind};
use crate::epoch;

/// A permission notification follows its request within moments.
const RECENT: Duration = Duration::from_secs(30);

pub fn run() -> i32 {
    let Some((dir, pane)) = pane() else { return 0 };
    let mut raw = String::new();
    if std::io::stdin().read_to_string(&mut raw).is_err() {
        return 0;
    }
    // A byte order mark, as some writers put first, is not JSON.
    let Ok(input) = serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')) else { return 0 };
    // A failed write only loses this one update.
    let state_file = pane_file(&dir, &pane, FileKind::State);
    if let Some(record) = state_record(&input, recent_record(&state_file).as_ref()) {
        let _ = write_atomic(&state_file, &record.to_string());
    }
    if let Some(record) = model_record(&input) {
        let _ = write_atomic(&pane_file(&dir, &pane, FileKind::Model), &record.to_string());
    }
    match subagent_change(&input, epoch::now_millis()) {
        Some(SubagentChange::Start { id, record }) if is_subagent_id(&id) => {
            let _ = write_atomic(&subagent_path(&dir, &pane, &id), &record.to_string());
        }
        Some(SubagentChange::Stop { id }) if is_subagent_id(&id) => {
            let _ = std::fs::remove_file(subagent_path(&dir, &pane, &id));
        }
        Some(SubagentChange::Clear) => remove_subagents(&dir, &pane),
        _ => {}
    }
    0
}

/// The pane's state record when it was written within RECENT, so a record of
/// an earlier prompt is not taken for this one.
fn recent_record(file: &Path) -> Option<Value> {
    let age = file.metadata().ok()?.modified().ok()?.elapsed().ok()?;
    let text = (age <= RECENT).then(|| std::fs::read_to_string(file).ok())??;
    serde_json::from_str(&text).ok()
}

/// The agent folder and the pane's key, from the variables Heron gives each
/// shell.
fn pane() -> Option<(PathBuf, String)> {
    let pane = std::env::var("HERON_PANE").ok()?;
    let dir = std::env::var_os("HERON_AGENT_DIR")?;
    is_pane_key(&pane).then(|| (Path::new(&dir).to_owned(), pane))
}

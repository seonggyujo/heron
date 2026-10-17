//! Link to coding agents (Claude Code) running in the panes. Heron puts
//! two invisible variables in every shell:
//!   HERON_PANE       the pane's key, `<Heron pid>-<pty id>`
//!   HERON_AGENT_DIR  the folder to write into
//! What sees them writes small files there: Heron's own hooks (see
//! claude_hooks/) `<key>.state.json`, `<key>.model.json` and one
//! `<key>.sub.<id>.json` per running subagent, the heron-limits plugin's
//! status line `<key>.status.json`. This module watches those files for
//! live panes, checks the model of each new answer in the transcript the
//! hooks name, reads from it what the agent is doing and the tokens it used
//! (conversation.rs), and sends every change to the frontend as an `agent-update`
//! event. It never talks to the agent itself.

mod activity;
mod answers;
mod conversation;
mod entries;
mod file_names;
mod files;
mod model_check;
mod poll;
mod subagents;
mod timestamps;
mod token_scan;
mod tokens;
mod transcript;
mod watch;

pub use file_names::{is_key as is_pane_key, is_subagent_id, path_for as pane_file, subagent_path, Kind as FileKind};
pub use files::remove_subagents;

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use log::{debug, warn};
use tauri::AppHandle;

pub struct AgentLink {
    dir: PathBuf,
    panes: Arc<Mutex<HashSet<u32>>>,
}

impl AgentLink {
    /// Creates the folder and clears files left by earlier runs.
    pub fn new(dir: PathBuf) -> Self {
        if let Err(e) = std::fs::create_dir_all(&dir) {
            warn!("agent: cannot create {}: {e}", dir.display());
        }
        files::remove_stale(&dir);
        debug!("agent: watching {}", dir.display());
        Self { dir, panes: Arc::default() }
    }

    /// Variables for the shell of pane `pty`.
    pub fn pane_env(&self, pty: u32) -> [(&'static str, String); 2] {
        [
            ("HERON_PANE", file_names::key(pty)),
            ("HERON_AGENT_DIR", self.dir.to_string_lossy().into_owned()),
        ]
    }

    pub fn track(&self, pty: u32) {
        self.panes.lock().unwrap().insert(pty);
    }

    /// The pane closed: stop watching it and delete its files.
    pub fn forget(&self, pty: u32) {
        self.panes.lock().unwrap().remove(&pty);
        files::remove_pane(&self.dir, pty);
    }

    /// App exit or page reload: every pane is gone.
    pub fn forget_all(&self) {
        let panes: Vec<u32> = self.panes.lock().unwrap().drain().collect();
        for pty in panes {
            files::remove_pane(&self.dir, pty);
        }
    }

    pub fn start(&self, app: AppHandle) {
        poll::spawn(app, self.dir.clone(), self.panes.clone());
    }
}

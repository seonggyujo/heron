//! The live PTY sessions by id, and the next id.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use log::info;
use portable_pty::CommandBuilder;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::AppHandle;

use super::session::PtySession;
use super::shell::ShellKind;

/// All live sessions by id. The map lock is held only to look up, insert or
/// remove an `Arc`; all PTY work happens after it is released.
#[derive(Default)]
pub struct PtyRegistry {
    next_id: AtomicU32,
    sessions: Mutex<HashMap<u32, Arc<PtySession>>>,
}

impl PtyRegistry {
    /// Starts `shell`. `command` builds its command line for the new id, so
    /// the caller can add environment that names the pane.
    pub fn spawn(
        &self,
        app: AppHandle,
        shell: ShellKind,
        cols: u16,
        rows: u16,
        out: Channel<InvokeResponseBody>,
        command: impl FnOnce(u32) -> Result<CommandBuilder, String>,
    ) -> Result<u32, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let session = PtySession::spawn(app, id, shell, command(id)?, cols, rows, out)?;
        let count = {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(id, session);
            sessions.len()
        };
        info!("registry: pty {id} added, {count} running");
        Ok(id)
    }

    pub fn get(&self, id: u32) -> Result<Arc<PtySession>, String> {
        self.sessions
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| format!("no pty with id {id}"))
    }

    pub fn remove(&self, id: u32) -> Option<Arc<PtySession>> {
        let (session, count) = {
            let mut sessions = self.sessions.lock().unwrap();
            (sessions.remove(&id), sessions.len())
        };
        info!("registry: pty {id} removed, {count} left");
        session
    }

    /// Kills every shell. Called on app exit and on page (re)load.
    pub fn kill_all(&self) {
        let sessions: Vec<_> = self.sessions.lock().unwrap().drain().collect();
        if sessions.is_empty() {
            return;
        }
        info!("registry: killing {} pty", sessions.len());
        for (_, session) in sessions {
            session.kill();
        }
    }
}

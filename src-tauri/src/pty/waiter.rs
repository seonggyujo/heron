//! The waiter thread of one PTY: waits for the shell to end, then closes
//! up in an order that keeps the last output, and tells the frontend.

use std::sync::Arc;
use std::thread::{self, JoinHandle};

use log::{info, warn};
use portable_pty::Child;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::session::PtySession;

const EXIT_EVENT: &str = "pty-exit";

#[derive(Clone, Serialize)]
struct PtyExit {
    id: u32,
    code: i32,
}

/// Waits for the shell to end, then closes the pseudo console so the reader
/// sees EOF, lets the batcher flush the last output, and only then emits
/// `pty-exit`. That order keeps the final lines from being lost.
pub fn spawn(
    app: AppHandle,
    id: u32,
    mut child: Box<dyn Child + Send + Sync>,
    session: Arc<PtySession>,
    batcher: JoinHandle<()>,
) {
    thread::Builder::new()
        .name(format!("pty-{id}-waiter"))
        .spawn(move || {
            let code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(e) => {
                    warn!("pty {id}: wait failed: {e}");
                    -1
                }
            };
            info!("pty {id}: shell exited with code {code}");

            session.close();
            drop(session);
            let _ = batcher.join();

            if let Err(e) = app.emit(EXIT_EVENT, PtyExit { id, code }) {
                warn!("pty {id}: emit {EXIT_EVENT} failed: {e}");
            }
        })
        .expect("spawn pty waiter thread");
}

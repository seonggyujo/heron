//! The input thread of one PTY: keystrokes in order, never blocking the
//! caller.

use std::io::Write;
use std::sync::mpsc::{self, Sender};
use std::thread;

use log::{debug, warn};

/// Starts a thread that owns the PTY input pipe. Commands only queue bytes,
/// so keystrokes keep their order and the main thread never blocks on a
/// full pipe. The thread ends when the returned sender is dropped.
pub fn spawn(id: u32, mut writer: Box<dyn Write + Send>) -> Sender<Vec<u8>> {
    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    thread::Builder::new()
        .name(format!("pty-{id}-writer"))
        .spawn(move || {
            for data in rx {
                if let Err(e) = writer.write_all(&data).and_then(|()| writer.flush()) {
                    warn!("pty {id}: write failed: {e}");
                    break;
                }
            }
            debug!("pty {id}: writer finished");
        })
        .expect("spawn pty writer thread");
    tx
}

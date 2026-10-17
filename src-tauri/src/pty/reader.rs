//! The reader thread of one PTY: blocking 64 KB reads into a small bounded
//! channel, which is where backpressure starts.

use std::io::{ErrorKind, Read};
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::thread;

use log::{debug, warn};

const READ_BUF: usize = 64 * 1024;
/// Chunks allowed in flight between reader and batcher. When full, the
/// reader blocks on `send`, which is the backpressure point.
const CHANNEL_CAP: usize = 4;

/// Starts a thread doing blocking reads on the PTY output (no polling).
/// The returned receiver ends when the PTY is closed.
pub fn spawn(id: u32, mut reader: Box<dyn Read + Send>) -> Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::sync_channel(CHANNEL_CAP);
    thread::Builder::new()
        .name(format!("pty-{id}-reader"))
        .spawn(move || {
            let total = read_loop(id, &mut reader, &tx);
            debug!("pty {id}: reader finished after {total} bytes");
        })
        .expect("spawn pty reader thread");
    rx
}

fn read_loop(id: u32, reader: &mut dyn Read, tx: &SyncSender<Vec<u8>>) -> usize {
    let mut buf = vec![0u8; READ_BUF];
    let mut total = 0;
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                total += n;
                if tx.send(buf[..n].to_vec()).is_err() {
                    break;
                }
            }
            Err(e) if e.kind() == ErrorKind::Interrupted => continue,
            Err(e) => {
                warn!("pty {id}: read failed: {e}");
                break;
            }
        }
    }
    total
}

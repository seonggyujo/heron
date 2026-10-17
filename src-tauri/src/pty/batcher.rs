//! The batcher thread of one PTY: merges the reader's chunks and sends them
//! to the frontend's channel every 12 ms or 64 KB.

use std::sync::mpsc::{Receiver, RecvTimeoutError, TryRecvError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use log::{debug, trace, warn};
use tauri::ipc::{Channel, InvokeResponseBody};

use super::gate::FlowGate;

/// At most one flush per interval while output is streaming.
const FLUSH_INTERVAL: Duration = Duration::from_millis(12);
const MAX_BATCH: usize = 64 * 1024;

/// Merges reader chunks and sends them to the frontend as raw bytes
/// (not a JSON number array). A lone chunk after a quiet period goes out at
/// once, so typing echo has no added latency.
pub fn spawn(
    id: u32,
    rx: Receiver<Vec<u8>>,
    gate: Arc<FlowGate>,
    out: Channel<InvokeResponseBody>,
) -> JoinHandle<()> {
    thread::Builder::new()
        .name(format!("pty-{id}-batcher"))
        .spawn(move || {
            let flushes = batch_loop(id, &rx, &gate, &out);
            debug!("pty {id}: batcher finished after {flushes} flushes");
        })
        .expect("spawn pty batcher thread")
}

fn batch_loop(
    id: u32,
    rx: &Receiver<Vec<u8>>,
    gate: &FlowGate,
    out: &Channel<InvokeResponseBody>,
) -> u64 {
    let mut last_flush = Instant::now() - FLUSH_INTERVAL;
    let mut flushes = 0;
    loop {
        gate.wait_open();
        let Ok(mut buf) = rx.recv() else { return flushes };

        let deadline = last_flush + FLUSH_INTERVAL;
        let mut closed = false;
        while buf.len() < MAX_BATCH {
            match next_chunk(rx, deadline) {
                Next::Chunk(c) => buf.extend_from_slice(&c),
                Next::Idle => break,
                Next::Closed => {
                    closed = true;
                    break;
                }
            }
        }

        trace!("pty {id}: flush {} bytes", buf.len());
        if let Err(e) = out.send(InvokeResponseBody::Raw(buf)) {
            warn!("pty {id}: output channel closed: {e}");
            return flushes;
        }
        flushes += 1;
        if closed {
            return flushes;
        }
        last_flush = Instant::now();
    }
}

enum Next {
    Chunk(Vec<u8>),
    Idle,
    Closed,
}

/// Waits for more output until `deadline`; past it, only takes what is
/// already queued.
fn next_chunk(rx: &Receiver<Vec<u8>>, deadline: Instant) -> Next {
    let now = Instant::now();
    if now >= deadline {
        return match rx.try_recv() {
            Ok(c) => Next::Chunk(c),
            Err(TryRecvError::Empty) => Next::Idle,
            Err(TryRecvError::Disconnected) => Next::Closed,
        };
    }
    match rx.recv_timeout(deadline - now) {
        Ok(c) => Next::Chunk(c),
        Err(RecvTimeoutError::Timeout) => Next::Idle,
        Err(RecvTimeoutError::Disconnected) => Next::Closed,
    }
}

//! The pause switch of one PTY's output (flow control from the frontend).

use std::sync::{Condvar, Mutex};

/// Pause switch for one PTY's output. While closed, the batcher stops
/// draining the reader, the bounded channel fills up and the reader thread
/// blocks, so the shell itself is throttled instead of memory growing.
#[derive(Default)]
pub struct FlowGate {
    paused: Mutex<bool>,
    changed: Condvar,
}

impl FlowGate {
    pub fn pause(&self) {
        *self.paused.lock().unwrap() = true;
    }

    pub fn resume(&self) {
        *self.paused.lock().unwrap() = false;
        self.changed.notify_all();
    }

    /// Blocks the calling thread until the gate is open.
    pub fn wait_open(&self) {
        let mut paused = self.paused.lock().unwrap();
        while *paused {
            paused = self.changed.wait(paused).unwrap();
        }
    }
}

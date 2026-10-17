//! One running shell: starting it, input, resize, pause, kill and close.

use std::fmt::Display;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

use log::{debug, info};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::AppHandle;

use super::gate::FlowGate;
use super::shell::ShellKind;
use super::{batcher, reader, waiter, writer};

/// One running shell. Each piece has its own lock, so a slow resize never
/// blocks input and nothing here is held while doing I/O.
pub struct PtySession {
    id: u32,
    /// Dropping the master closes the pseudo console.
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    input: Sender<Vec<u8>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    gate: Arc<FlowGate>,
}

fn err(e: impl Display) -> String {
    e.to_string()
}

impl PtySession {
    /// `shell` only names the session in logs; `command` is what runs.
    pub fn spawn(
        app: AppHandle,
        id: u32,
        shell: ShellKind,
        command: CommandBuilder,
        cols: u16,
        rows: u16,
        out: Channel<InvokeResponseBody>,
    ) -> Result<Arc<Self>, String> {
        let size = PtySize { rows, cols, pixel_width: 0, pixel_height: 0 };
        let pair = native_pty_system().openpty(size).map_err(err)?;
        let reader = pair.master.try_clone_reader().map_err(err)?;
        let input = writer::spawn(id, pair.master.take_writer().map_err(err)?);

        let child = pair.slave.spawn_command(command).map_err(err)?;
        // The slave shares the pseudo console with the master. If it stays
        // alive the console never closes and the reader never sees EOF.
        drop(pair.slave);
        info!("pty {id}: spawned {shell:?} pid={:?} size={cols}x{rows}", child.process_id());

        let gate = Arc::new(FlowGate::default());
        let batcher = batcher::spawn(id, reader::spawn(id, reader), gate.clone(), out);
        let session = Arc::new(Self {
            id,
            master: Mutex::new(Some(pair.master)),
            input,
            killer: Mutex::new(child.clone_killer()),
            gate,
        });
        waiter::spawn(app, id, child, session.clone(), batcher);
        Ok(session)
    }

    pub fn write(&self, data: Vec<u8>) -> Result<(), String> {
        self.input.send(data).map_err(|_| format!("pty {} is closed", self.id))
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let master = self.master.lock().unwrap();
        let Some(master) = master.as_ref() else { return Ok(()) };
        master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(err)?;
        debug!("pty {}: resized to {cols}x{rows}", self.id);
        Ok(())
    }

    pub fn pause(&self) {
        self.gate.pause();
        debug!("pty {}: output paused (frontend is behind)", self.id);
    }

    pub fn resume(&self) {
        self.gate.resume();
        debug!("pty {}: output resumed", self.id);
    }

    /// Terminates the shell and closes the pseudo console.
    pub fn kill(&self) {
        // portable-pty 0.9 on Windows reports Err when TerminateProcess
        // *succeeds* (inverted check), so the result carries no signal.
        // Closing the pseudo console below ends the shell either way.
        let _ = self.killer.lock().unwrap().kill();
        debug!("pty {}: kill requested", self.id);
        self.close();
    }

    /// Closes the pseudo console. Idempotent. The gate is opened first so
    /// the reader keeps draining; ClosePseudoConsole can wait on that.
    pub fn close(&self) {
        self.gate.resume();
        let master = self.master.lock().unwrap().take();
        if let Some(master) = master {
            drop(master);
            debug!("pty {}: pseudo console closed", self.id);
        }
    }
}

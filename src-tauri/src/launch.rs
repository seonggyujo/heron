//! Opening Heron on a folder. The Explorer menu "Open in Heron"
//! runs `heron.exe "<folder>"`.
//!
//! - First launch: the folder is kept here and the frontend takes it for
//!   its first pane (`take_launch_dir`, commands/window.rs).
//! - Launch while Heron is already running (release builds use the
//!   single-instance plugin): the new process exits and the running window
//!   gets an `open-folder` event, so the folder opens as a new pane there.

use std::path::Path;
use std::sync::Mutex;

use log::info;
use tauri::{AppHandle, Emitter, Manager};

// Only used by the single-instance hook, which dev builds leave out.
#[cfg_attr(debug_assertions, allow(dead_code))]
const OPEN_FOLDER_EVENT: &str = "open-folder";

#[derive(Default)]
pub struct LaunchDir(Mutex<Option<String>>);

impl LaunchDir {
    pub fn from_args() -> Self {
        Self(Mutex::new(folder_arg(std::env::args())))
    }

    /// The folder, once; later calls get `None`.
    pub fn take(&self) -> Option<String> {
        self.0.lock().unwrap().take()
    }
}

/// First argument that names an existing folder. Explorer passes `"%V"`;
/// for a drive root that arrives as `C:"` (the backslash escapes the
/// closing quote), so a trailing quote is dropped and the root restored.
fn folder_arg(args: impl IntoIterator<Item = String>) -> Option<String> {
    args.into_iter().skip(1).find_map(|arg| {
        let mut path = arg.trim_end_matches('"').to_string();
        if path.ends_with(':') {
            path.push('\\');
        }
        Path::new(&path).is_dir().then_some(path)
    })
}

/// Called in the running instance when another launch is attempted.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn on_second_instance(app: &AppHandle, args: Vec<String>, _cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    if let Some(dir) = folder_arg(args) {
        info!("launch: open folder from second instance: {dir}");
        let _ = app.emit(OPEN_FOLDER_EVENT, dir);
    }
}

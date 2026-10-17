//! Tauri commands. Thin layer: argument plumbing only, logic lives in
//! `pty`, `agent`, `claude_hooks`, `sessions`, `git`, `attention` and `launch`.
//!   pty.rs      shells and their terminals
//!   claude.rs   Claude Code: Heron's hooks, sessions
//!   folders.rs  folders: git, the folder picker
//!   window.rs   the taskbar flash, the folder Heron was started on

pub mod claude;
pub mod folders;
pub mod pty;
pub mod window;

/// Frontend log lines, printed in the `tauri dev` terminal.
#[tauri::command]
pub fn frontend_log(level: String, scope: String, message: String) {
    let level = match level.as_str() {
        "error" => log::Level::Error,
        "warn" => log::Level::Warn,
        "info" => log::Level::Info,
        _ => log::Level::Debug,
    };
    log::log!(target: "web", level, "[{scope}] {message}");
}

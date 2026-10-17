//! Heron's own Claude Code hooks, so agents in the panes report what
//! they do and which model they use, without any plugin. With the user's consent
//! (the sidebar or Settings), Heron adds entries to Claude Code's
//! settings.json that run `heron.exe --agent-hook` on a few events
//! (entry.rs writes the pane's state, model and subagent files). The uninstaller and Settings run
//! `remove`, which leaves the user's own hooks as they were.

mod config;
#[cfg(test)]
mod config_tests;
mod entry;
mod records;
mod settings_file;
mod version;

use std::path::Path;

pub use config::Presence;
pub use entry::run as run_hook;

/// Argument that makes heron.exe run as a hook.
pub const HOOK_FLAG: &str = "--agent-hook";
/// Argument that makes heron.exe remove its hooks (used by the uninstaller).
pub const REMOVE_FLAG: &str = "--remove-agent-hooks";

#[derive(Debug)]
pub enum HookError {
    ClaudeNotFound,
    ClaudeTooOld(String),
    SettingsInvalid,
    Io(String),
}

impl HookError {
    /// What the frontend gets; it shows a message per code. Logs the details.
    pub fn code(&self) -> String {
        match self {
            HookError::Io(detail) => log::warn!("claude hooks: {detail}"),
            other => log::warn!("claude hooks: {other:?}"),
        }
        match self {
            HookError::ClaudeNotFound => "claude-not-found".into(),
            HookError::ClaudeTooOld(version) => format!("claude-too-old:{version}"),
            HookError::SettingsInvalid => "settings-invalid".into(),
            HookError::Io(_) => "io".into(),
        }
    }
}

pub fn presence() -> Result<Presence, HookError> {
    Ok(config::presence(&settings_file::read()?, &current_exe()?))
}

/// Adds the hooks for this heron.exe, replacing older ones.
pub fn install() -> Result<(), HookError> {
    version::check()?;
    let mut settings = settings_file::read()?;
    let exe = current_exe()?;
    config::add(&mut settings, &exe).map_err(|_| HookError::SettingsInvalid)?;
    settings_file::write(&settings)?;
    log::info!("claude hooks: added, running {exe}");
    Ok(())
}

pub fn remove() -> Result<(), HookError> {
    let mut settings = settings_file::read()?;
    if config::remove(&mut settings) {
        settings_file::write(&settings)?;
        log::info!("claude hooks: removed");
    }
    Ok(())
}

fn current_exe() -> Result<String, HookError> {
    let exe = std::env::current_exe().map_err(|e| HookError::Io(e.to_string()))?;
    Ok(exe.to_string_lossy().into_owned())
}

/// Writes a temporary file next to `path`, then renames it over `path`, so a
/// reader never sees half a file.
fn write_atomic(path: &Path, text: &str) -> std::io::Result<()> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(format!(".{}.tmp", std::process::id()));
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, path)
}

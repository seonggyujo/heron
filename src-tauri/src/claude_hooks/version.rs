//! The version of the Claude Code on PATH (`claude --version`). Heron's
//! hooks use the `args` form of a command hook. Versions before it treat
//! the entry as a shell command without the flag, which would start the app
//! on every hook event, so hooks are only installed for newer versions.

use super::HookError;
use crate::claude_version::{self, Version};
use crate::hidden_command::hidden_command;

const MINIMUM: Version = (2, 1, 139);

pub fn check() -> Result<(), HookError> {
    // Through cmd: `claude` may be a .cmd shim (npm install).
    let output = hidden_command("cmd")
        .args(["/D", "/C", "claude", "--version"])
        .output()
        .map_err(|_| HookError::ClaudeNotFound)?;
    let text = String::from_utf8_lossy(&output.stdout);
    let version = claude_version::parse(&text).filter(|_| output.status.success()).ok_or(HookError::ClaudeNotFound)?;
    if version < MINIMUM {
        let (major, minor, patch) = version;
        return Err(HookError::ClaudeTooOld(format!("{major}.{minor}.{patch}")));
    }
    Ok(())
}

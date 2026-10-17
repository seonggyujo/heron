//! Claude Code's user settings file: `settings.json` in its config folder
//! (claude_dir.rs). Reads it, and writes it back atomically after copying
//! the previous version next to it. A file that is not valid JSON is never
//! written over.

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use super::{write_atomic, HookError};
use crate::claude_dir::config_dir;

const BACKUP_SUFFIX: &str = ".heron-backup";

fn path() -> Option<PathBuf> {
    Some(config_dir()?.join("settings.json"))
}

/// The parsed file; an empty object when there is none yet.
pub fn read() -> Result<Value, HookError> {
    let path = path().ok_or_else(|| HookError::Io("no home folder".into()))?;
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Value::Object(Default::default())),
        Err(e) => return Err(HookError::Io(e.to_string())),
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(value) if value.is_object() => Ok(value),
        _ => Err(HookError::SettingsInvalid),
    }
}

pub fn write(settings: &Value) -> Result<(), HookError> {
    let path = path().ok_or_else(|| HookError::Io("no home folder".into()))?;
    let io = |e: std::io::Error| HookError::Io(e.to_string());
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(io)?;
    }
    if path.exists() {
        let mut backup = path.clone().into_os_string();
        backup.push(BACKUP_SUFFIX);
        fs::copy(&path, backup).map_err(io)?;
    }
    // Two-space JSON, like Claude Code writes it.
    let text = serde_json::to_string_pretty(settings).map_err(|e| HookError::Io(e.to_string()))? + "\n";
    write_atomic(&path, &text).map_err(io)
}

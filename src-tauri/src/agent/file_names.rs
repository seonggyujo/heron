//! The names of the files agents write for a pane, and checks that a name
//! built from outside input stays in the agents folder. Pure.

use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Kind {
    /// Written by the heron-limits plugin's status line: usage limits,
    /// context use.
    Status,
    /// Written by hooks: working, needs permission, waiting, done, and the
    /// transcript.
    State,
    /// Written by hooks: the model the session uses.
    Model,
}

pub const KINDS: [Kind; 3] = [Kind::Status, Kind::State, Kind::Model];

impl Kind {
    pub fn name(self) -> &'static str {
        match self {
            Kind::Status => "status",
            Kind::State => "state",
            Kind::Model => "model",
        }
    }
}

/// Unique among running Heron windows: the process id, then the pty id.
pub fn key(pty: u32) -> String {
    format!("{}-{pty}", std::process::id())
}

/// A key as `key` makes it, so a file name built from it stays in `dir`.
pub fn is_key(text: &str) -> bool {
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    text.split_once('-').is_some_and(|(pid, pty)| digits(pid) && digits(pty))
}

/// The file of pane `key` (see `key`).
pub fn path_for(dir: &Path, key: &str, kind: Kind) -> PathBuf {
    dir.join(format!("{key}.{}.json", kind.name()))
}

pub fn path(dir: &Path, pty: u32, kind: Kind) -> PathBuf {
    path_for(dir, &key(pty), kind)
}

/// A subagent id as Claude Code gives it (letters, digits, `-`, `_`), so a
/// file name built from it stays in `dir`.
pub fn is_subagent_id(text: &str) -> bool {
    !text.is_empty() && text.len() <= 64 && text.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Written by hooks while a subagent of pane `key` runs: `<key>.sub.<id>.json`.
pub fn subagent_path(dir: &Path, key: &str, id: &str) -> PathBuf {
    dir.join(format!("{key}.sub.{id}.json"))
}

/// The start of the names of pane `key`'s subagent files.
pub fn subagent_prefix(key: &str) -> String {
    format!("{key}.sub.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_subagent_id_cannot_leave_the_folder() {
        assert!(is_subagent_id("a65cc6212ebfce9ef"));
        assert!(is_subagent_id("agent_1-x"));
        for bad in ["", "..", "a/b", r"a\b", "a.b", "a:b"] {
            assert!(!is_subagent_id(bad), "{bad}");
        }
    }

    #[test]
    fn a_pane_key_is_two_numbers() {
        assert!(is_key(&key(7)));
        for bad in ["", "12", "12-", "-3", "1-2-3", "a-1", "1-..\\x"] {
            assert!(!is_key(bad), "{bad}");
        }
    }
}

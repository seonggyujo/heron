//! What git says about a folder, for the agent sidebar: whether it is in a
//! repository (a new agent can start in a worktree there) and how far the
//! repository's working tree is from HEAD. Runs the git on PATH without a
//! console window and without taking git's optional locks, so an agent's
//! own git commands never meet a lock of ours.

mod new_files;
mod numstat;

use std::path::Path;

use crate::hidden_command::hidden_command;

pub use numstat::Changes;

/// git's empty tree: what a repository without commits is compared with.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
/// Only this many new files have their lines counted.
const MAX_COUNTED_FILES: usize = 200;

/// The top folder of the working tree `dir` is in: the nearest folder,
/// `dir` or above, with a `.git` folder (a repository) or file (a worktree).
pub fn root(dir: &Path) -> Option<&Path> {
    dir.ancestors().find(|d| d.join(".git").exists())
}

/// Tracked changes since HEAD, staged or not, plus untracked files that are
/// not ignored. None outside a repository or when git fails.
pub fn changes(dir: &Path) -> Option<Changes> {
    let root = root(dir)?;
    let tracked = git(root, &["diff", "--numstat", "HEAD", "--"]).or_else(|| git(root, &["diff", "--numstat", EMPTY_TREE, "--"]))?;
    let mut changes = numstat::parse(&tracked);
    let untracked = git(root, &["ls-files", "--others", "--exclude-standard", "-z"])?;
    for (i, name) in untracked.split('\0').filter(|n| !n.is_empty()).enumerate() {
        let lines = if i < MAX_COUNTED_FILES { new_files::lines(&root.join(name)) } else { 0 };
        changes.add_new_file(lines);
    }
    Some(changes)
}

/// git's output, or None when it cannot run or fails.
fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = hidden_command("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

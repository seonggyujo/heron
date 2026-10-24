//! Commands about folders: what git says about them (`git`) and the folder
//! picker for a new agent.

use std::path::Path;

use tauri::Window;
use tauri_plugin_dialog::DialogExt;

use crate::git;

/// How far the repository `dir` is in has moved from HEAD. None outside a
/// repository. Async: it runs git.
#[tauri::command(async)]
pub fn git_changes(dir: String) -> Option<git::Changes> {
    let dir = Path::new(&dir);
    if dir.is_dir() {
        git::changes(dir)
    } else {
        None
    }
}

/// The branch the folder `dir` is on. None outside a repository. Async: it
/// reads files.
#[tauri::command(async)]
pub fn git_branch(dir: String) -> Option<String> {
    let dir = Path::new(&dir);
    if dir.is_dir() {
        git::branch(dir)
    } else {
        None
    }
}

/// For each folder, whether it is in a git repository.
#[tauri::command(async)]
pub fn git_repos(dirs: Vec<String>) -> Vec<bool> {
    dirs.iter().map(Path::new).map(|d| d.is_dir() && git::root(d).is_some()).collect()
}

/// Asks for a folder in a dialog over the window. None when cancelled.
/// Async: the dialog blocks until it closes.
#[tauri::command(async)]
pub fn pick_folder(window: Window) -> Option<String> {
    let picked = window.dialog().file().set_parent(&window).blocking_pick_folder()?;
    Some(picked.into_path().ok()?.to_string_lossy().into_owned())
}

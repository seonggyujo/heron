//! Window commands: flashing the taskbar button (`attention`), the folder
//! Heron was started on (`launch`) and the system menu (`window_menu`).

use tauri::State;

use crate::attention;
use crate::launch::LaunchDir;
use crate::window_menu::{self, MenuAt};

#[tauri::command]
pub fn flash_taskbar(window: tauri::WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    attention::flash(hwnd.0);
}

/// The window's system menu, at the mouse or at the window's corner. It
/// runs on the UI thread, after this command has answered.
#[tauri::command]
pub fn show_window_menu(window: tauri::WebviewWindow, at_cursor: bool) {
    let Ok(hwnd) = window.hwnd() else { return };
    // A raw window handle cannot cross threads; its number can.
    let hwnd = hwnd.0 as usize;
    let at = if at_cursor { MenuAt::Cursor } else { MenuAt::WindowCorner };
    let _ = window.run_on_main_thread(move || window_menu::show(hwnd as *mut std::ffi::c_void, at));
}

/// The folder Heron was started on, once; later calls get `None`.
#[tauri::command]
pub fn take_launch_dir(state: State<'_, LaunchDir>) -> Option<String> {
    state.take()
}

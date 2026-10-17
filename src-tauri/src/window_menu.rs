//! The window's system menu (Restore, Move, Size, Minimize, Maximize,
//! Close) for Heron's own title bar: on a right-click there and on
//! Alt+Space, as in any window. Windows Terminal does the same for its
//! frameless window: the menu's items are set for the window's state
//! (TrackPopupMenu leaves them as they are), the menu is tracked, and the
//! chosen command goes to the window as WM_SYSCOMMAND. WebView2 eats
//! Alt+Space (WebView2Feedback#3840), so the page catches it instead.

use std::ffi::c_void;

const SC_SIZE: u32 = 0xF000;
const SC_MOVE: u32 = 0xF010;
const SC_MINIMIZE: u32 = 0xF020;
const SC_MAXIMIZE: u32 = 0xF030;
const SC_RESTORE: u32 = 0xF120;
const MF_GRAYED: u32 = 0x1;
const MF_ENABLED: u32 = 0x0;
const MF_BYCOMMAND: u32 = 0x0;
const TPM_RIGHTBUTTON: u32 = 0x2;
const TPM_RETURNCMD: u32 = 0x100;
const WM_SYSCOMMAND: u32 = 0x112;

#[repr(C)]
#[derive(Default)]
struct Point {
    x: i32,
    y: i32,
}

#[repr(C)]
#[derive(Default)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[link(name = "user32")]
extern "system" {
    fn GetSystemMenu(hwnd: *mut c_void, revert: i32) -> *mut c_void;
    fn EnableMenuItem(menu: *mut c_void, id: u32, flags: u32) -> i32;
    fn TrackPopupMenu(menu: *mut c_void, flags: u32, x: i32, y: i32, reserved: i32, hwnd: *mut c_void, rect: *const Rect) -> i32;
    fn PostMessageW(hwnd: *mut c_void, msg: u32, wparam: usize, lparam: isize) -> i32;
    fn IsZoomed(hwnd: *mut c_void) -> i32;
    fn GetCursorPos(point: *mut Point) -> i32;
    fn GetWindowRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
}

/// Where the menu opens.
pub enum MenuAt {
    /// At the mouse (a right-click on the title bar).
    Cursor,
    /// At the window's top-left corner (Alt+Space).
    WindowCorner,
}

/// Which items can be picked: a maximized window can be restored, but not
/// moved, sized or maximized again. Minimize and Close always can.
fn enabled_items(maximized: bool) -> [(u32, bool); 5] {
    [
        (SC_RESTORE, maximized),
        (SC_MOVE, !maximized),
        (SC_SIZE, !maximized),
        (SC_MINIMIZE, true),
        (SC_MAXIMIZE, !maximized),
    ]
}

/// Opens the system menu of window `hwnd` and carries out what is picked.
/// Call on the UI thread: the menu runs a modal loop there.
pub fn show(hwnd: *mut c_void, at: MenuAt) {
    // SAFETY: plain user32 calls on Heron's own window; the structs live
    // across the calls that fill them.
    unsafe {
        let menu = GetSystemMenu(hwnd, 0);
        if menu.is_null() {
            return;
        }
        for (id, on) in enabled_items(IsZoomed(hwnd) != 0) {
            EnableMenuItem(menu, id, MF_BYCOMMAND | if on { MF_ENABLED } else { MF_GRAYED });
        }
        let (x, y) = match at {
            MenuAt::Cursor => {
                let mut p = Point::default();
                GetCursorPos(&mut p);
                (p.x, p.y)
            }
            MenuAt::WindowCorner => {
                let mut r = Rect::default();
                GetWindowRect(hwnd, &mut r);
                (r.left, r.top)
            }
        };
        let command = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, x, y, 0, hwnd, std::ptr::null());
        if command != 0 {
            log::debug!("window menu: command {command:#x}");
            PostMessageW(hwnd, WM_SYSCOMMAND, command as usize, 0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_maximized_window_can_only_be_restored_minimized_or_closed() {
        let on = |maximized| enabled_items(maximized).into_iter().filter(|(_, on)| *on).map(|(id, _)| id).collect::<Vec<_>>();
        assert_eq!(on(true), [SC_RESTORE, SC_MINIMIZE]);
        assert_eq!(on(false), [SC_MOVE, SC_SIZE, SC_MINIMIZE, SC_MAXIMIZE]);
    }
}

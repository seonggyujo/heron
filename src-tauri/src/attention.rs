//! Flashes Heron's taskbar button while another app is in front, so an
//! agent that needs the user gets noticed. Tauri's request_user_attention is
//! not used: it skips the flash whenever Heron is the active window of
//! its own thread, which it stays while another app is in front (the cause
//! in tauri-apps/tao#942). The foreground window is checked instead.

use std::ffi::c_void;

const FLASHW_TRAY: u32 = 0x2;
/// After these flashes the button stays highlighted until Heron comes
/// to the front.
const FLASH_COUNT: u32 = 3;

#[repr(C)]
struct FlashInfo {
    size: u32,
    hwnd: *mut c_void,
    flags: u32,
    count: u32,
    timeout: u32,
}

#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> *mut c_void;
    fn FlashWindowEx(info: *const FlashInfo) -> i32;
}

/// Flashes the button of the window `hwnd`, unless it is in front.
pub fn flash(hwnd: *mut c_void) {
    // SAFETY: plain user32 calls; `info` lives across the call.
    if unsafe { GetForegroundWindow() } == hwnd {
        return;
    }
    let info = FlashInfo {
        size: std::mem::size_of::<FlashInfo>() as u32,
        hwnd,
        flags: FLASHW_TRAY,
        count: FLASH_COUNT,
        timeout: 0,
    };
    unsafe { FlashWindowEx(&info) };
    log::debug!("attention: taskbar button flashed");
}

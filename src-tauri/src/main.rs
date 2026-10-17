//! Entry point: a hook or uninstaller run ends here without a window, else
//! the app starts (lib.rs).

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Run as a Claude Code hook or by the uninstaller: no window at all.
    if let Some(code) = heron_lib::run_cli() {
        std::process::exit(code);
    }
    heron_lib::run()
}

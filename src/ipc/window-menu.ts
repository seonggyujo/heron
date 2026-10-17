import { invoke } from "@tauri-apps/api/core";

// The window's system menu (Restore, Move, Size, Minimize, Maximize,
// Close; src-tauri/src/window_menu.rs): at the mouse for a right-click on
// the title bar, at the window's corner for Alt+Space.

export const showWindowMenu = (atCursor: boolean) => invoke<void>("show_window_menu", { atCursor });

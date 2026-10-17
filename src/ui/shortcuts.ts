// The app's keyboard shortcuts, as in heron-c, caught before the terminal
// sees them:
//   Ctrl+Shift+T               a new pane with the default shell
//   Ctrl+Tab, Ctrl+Shift+Tab   the next, the previous pane (in the order opened)
//   Alt+Space                  the window's system menu (WebView2 eats it
//                              otherwise, WebView2Feedback#3840)

export interface ShortcutActions {
  newPane(): void;
  focusStep(step: 1 | -1): void;
  windowMenu(): void;
}

export function installShortcuts(actions: ShortcutActions): void {
  window.addEventListener(
    "keydown",
    (e) => {
      const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
      if (ctrl && e.shiftKey && e.code === "KeyT") {
        if (!e.repeat) actions.newPane();
      } else if (ctrl && e.key === "Tab") {
        actions.focusStep(e.shiftKey ? -1 : 1);
      } else if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.code === "Space") {
        if (!e.repeat) actions.windowMenu();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );
}

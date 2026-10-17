// A mouse press on one of the app's buttons (title bar, sidebar, settings,
// menus) leaves the keyboard with the selected pane, as in heron-c: typing
// goes on into the terminal after the click. The button still gets its
// click, and the Tab key still reaches every button.

export function keepPaneFocus(): void {
  document.addEventListener(
    "mousedown",
    (e) => {
      const target = e.target as Element;
      if (e.button !== 0 || !target.closest("button") || target.closest(".xterm")) return;
      e.preventDefault();
    },
    { capture: true },
  );
}

import type { Terminal } from "@xterm/xterm";
import { createLogger } from "../app/log";
import { copySelection } from "./clipboard";

// Keyboard glue between xterm and the WebView.
// 1. Browser shortcuts (reload, find, print, back...) must never fire.
//    preventDefault in the capture phase stops the WebView, while xterm still
//    gets the keydown (it does not check defaultPrevented), so Ctrl+R still
//    reaches the shell as ^R.
// 2. Ctrl+C copies when text is selected, otherwise it is ^C. Ctrl+V pastes
//    (see clipboard.ts).

const log = createLogger("keys");

const BLOCKED = new Set([
  "f3", "f5", "f7",
  "ctrl+r", "ctrl+shift+r", "ctrl+f", "ctrl+g", "ctrl+shift+g", "ctrl+p",
  "ctrl+s", "ctrl+o", "ctrl+u", "ctrl+w", "ctrl+n", "ctrl+t", "ctrl+j", "ctrl+h",
  "ctrl+=", "ctrl+-", "ctrl+0", "ctrl+shift++",
  "alt+arrowleft", "alt+arrowright",
  "browserback", "browserforward", "browserrefresh",
]);

// DevTools stays reachable while developing.
const BLOCKED_IN_PROD = ["f12", "ctrl+shift+i", "ctrl+shift+j"];

function combo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

export function installShortcutGuard(): void {
  if (!import.meta.env.DEV) BLOCKED_IN_PROD.forEach((k) => BLOCKED.add(k));
  window.addEventListener(
    "keydown",
    (e) => {
      const key = combo(e);
      if (!BLOCKED.has(key)) return;
      e.preventDefault();
      if (!e.repeat) log.debug(`${key}: browser action blocked, the key still reaches the shell`);
    },
    { capture: true },
  );
  if (!import.meta.env.DEV) {
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/** Returns false for keys xterm must not turn into input. */
export function attachClipboardKeys(term: Terminal): void {
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown" || !e.ctrlKey || e.altKey) return true;
    const key = e.key.toLowerCase();

    if (key === "c" && copySelection(term)) return false;
    // Let the browser fire a paste event; clipboard.ts takes it.
    if (key === "v") return false;
    return true;
  });
}

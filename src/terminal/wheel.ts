import type { Terminal } from "@xterm/xterm";

// Shift+wheel scrolls the terminal itself, even while the program tracks
// the mouse (vim, a TUI) and would get the wheel otherwise, as in heron-c:
// the scrollback in the normal screen, arrow keys in a full-screen program
// (which is what xterm sends there without mouse tracking).

const LINES_PER_NOTCH = 3;
/** Chromium reports about this much per wheel notch. */
const NOTCH = 100;

export function attachShiftWheel(term: Terminal): void {
  term.attachCustomWheelEventHandler((e) => {
    if (!e.shiftKey) return true;
    // Chromium turns Shift+wheel into a sideways scroll.
    const delta = e.deltaY || e.deltaX;
    e.preventDefault();
    if (!delta) return false;
    const lines = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / NOTCH)) * LINES_PER_NOTCH;
    if (term.buffer.active.type === "alternate") {
      const app = term.modes.applicationCursorKeysMode;
      const key = lines < 0 ? (app ? "\x1bOA" : "\x1b[A") : app ? "\x1bOB" : "\x1b[B";
      term.input(key.repeat(Math.abs(lines)), false);
    } else {
      term.scrollLines(lines);
    }
    return false;
  });
}

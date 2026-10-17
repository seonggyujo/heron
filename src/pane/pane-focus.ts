import type { Pane } from "./pane";

// Which pane is selected (has the keyboard), for the pane manager: a pane
// that gets focus becomes it, and Ctrl+Tab steps through the panes.

export class PaneFocus {
  private current: Pane | null = null;

  constructor(private readonly onFocus: (pane: Pane) => void) {}

  get pane(): Pane | null {
    return this.current;
  }

  /** `pane` got the focus. */
  set(pane: Pane): void {
    if (this.current === pane) return;
    this.current?.setFocused(false);
    this.current = pane;
    pane.setFocused(true);
    this.onFocus(pane);
  }

  /** `pane` is gone. */
  forget(pane: Pane): void {
    if (this.current === pane) this.current = null;
  }

  /** Focuses the next (1) or previous (-1) of `panes`, going round. */
  step(panes: readonly Pane[], step: 1 | -1): void {
    const n = panes.length;
    if (n === 0) return;
    const at = this.current ? panes.indexOf(this.current) : -1;
    panes[at < 0 ? (step > 0 ? 0 : n - 1) : (at + step + n) % n].focus();
  }
}

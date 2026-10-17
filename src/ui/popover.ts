// Open/close for a panel under a button: opens below the anchor, right
// edges aligned (title bar) or left edges (agent sidebar); closes on outside
// click, Escape, window blur, or another click on the button that opened it
// ([aria-haspopup] inside the anchor). While it is open, keys come to it
// before the terminal (which keeps the keyboard, ui/keep-pane-focus.ts), so
// Escape and the keys the panel takes never reach the shell.

export interface Popover {
  toggle(anchor: HTMLElement): void;
  close(): void;
}

/**
 * `onOpen` runs right before the panel shows, e.g. to refresh it. `onKey`
 * gets the keys while it is open and returns true for the ones it took.
 */
export function createPopover(
  el: HTMLElement,
  onOpen?: () => void,
  align: "left" | "right" = "right",
  onKey?: (e: KeyboardEvent) => boolean,
): Popover {
  let anchorEl: HTMLElement | null = null;
  const onOutside = (e: MouseEvent) => {
    const target = e.target as Element;
    if (el.contains(target)) return;
    // A press on the button that opened the panel is left to its own
    // click, which toggles the panel shut. Closing here as well would
    // make that click open it again.
    const trigger = target.closest("[aria-haspopup]");
    if (trigger && anchorEl?.contains(trigger)) return;
    close();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (!onKey?.(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  function open(anchor: HTMLElement): void {
    anchorEl = anchor;
    onOpen?.();
    const r = anchor.getBoundingClientRect();
    el.style.top = `${r.bottom + 6}px`;
    if (align === "left") el.style.left = `${r.left}px`;
    else el.style.right = `${window.innerWidth - r.right}px`;
    el.classList.add("open");
    // Next tick, so the click that opened the panel does not close it.
    setTimeout(() => document.addEventListener("mousedown", onOutside));
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("blur", close);
  }

  function close(): void {
    el.classList.remove("open");
    document.removeEventListener("mousedown", onOutside);
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    window.removeEventListener("blur", close);
  }

  return {
    toggle: (anchor) => (el.classList.contains("open") ? close() : open(anchor)),
    close,
  };
}

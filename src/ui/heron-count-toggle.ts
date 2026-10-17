import { HERONS_MAX } from "../app/prefs";
import { createRadioGroup } from "./radio-group";

// Settings > Terminal herons: how many live in each agent pane, as a row of
// buttons (Off, 1, 2, 3).

export function createHeronCountToggle(initial: number, label: string, off: string, onChange: (count: number) => void): HTMLElement {
  const options = Array.from({ length: HERONS_MAX + 1 }, (_, n) => ({
    value: n,
    dress(b: HTMLButtonElement) {
      b.className = "tb-button";
      b.textContent = n === 0 ? off : String(n);
    },
  }));
  return createRadioGroup("tb-group heron-count-toggle", label, options, initial, onChange);
}

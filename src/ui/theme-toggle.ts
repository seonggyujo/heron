import type { Theme } from "../app/theme";
import { t } from "../i18n/lang";
import { createRadioGroup } from "./radio-group";

// Two swatches in the settings panel: black (the default) / green. Built
// each time the panel opens, so the labels are always in the current
// language.

const THEMES: Theme[] = ["black", "green"];

export function createThemeToggle(initial: Theme, onChange: (theme: Theme) => void): HTMLElement {
  const options = THEMES.map((id) => ({
    value: id,
    dress(b: HTMLButtonElement) {
      const label = id === "green" ? t().themeGreen : t().themeBlack;
      b.className = `theme-swatch theme-${id}`;
      b.setAttribute("aria-label", label);
      b.title = label;
    },
  }));
  return createRadioGroup("theme-toggle", t().theme, options, initial, onChange);
}

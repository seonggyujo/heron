import { THEMES, type Theme } from "../app/theme";
import { t } from "../i18n/lang";
import { createRadioGroup } from "./radio-group";

// Three swatches in the settings panel: gray (the default) / black / green.
// Built each time the panel opens, so the labels are always in the current
// language.

function labelOf(theme: Theme): string {
  const s = t();
  return { gray: s.themeGray, black: s.themeBlack, green: s.themeGreen }[theme];
}

export function createThemeToggle(initial: Theme, onChange: (theme: Theme) => void): HTMLElement {
  const options = THEMES.map((id) => ({
    value: id,
    dress(b: HTMLButtonElement) {
      const label = labelOf(id);
      b.className = `theme-swatch theme-${id}`;
      b.setAttribute("aria-label", label);
      b.title = label;
    },
  }));
  return createRadioGroup("theme-toggle", t().theme, options, initial, onChange);
}

import { pref } from "./prefs";

// App chrome theme (styles/themes.css), black unless the user picked green.
// The terminal is never themed.

export type Theme = "green" | "black";

const themePref = pref<Theme>("heron.theme", "black", (raw) => (raw === "green" || raw === "black" ? raw : undefined));

export function currentTheme(): Theme {
  return themePref.get();
}

/** Shows the saved theme: at startup, before any DOM is built, and after a reset. */
export function applyTheme(): void {
  const theme = themePref.get();
  if (theme === "green") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  themePref.set(theme);
  applyTheme();
}

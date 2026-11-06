import { pref } from "./prefs";

// App chrome theme (styles/themes.css), gray unless the user picked black
// or green. The terminal does not follow it: its colors are fixed in
// terminal/terminal-view.ts.

export type Theme = "gray" | "black" | "green";

/** Every theme, in the order the settings show them. */
export const THEMES: readonly Theme[] = ["gray", "black", "green"];

const isTheme = (raw: string): raw is Theme => (THEMES as readonly string[]).includes(raw);

const themePref = pref<Theme>("heron.theme", "gray", (raw) => (isTheme(raw) ? raw : undefined));

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

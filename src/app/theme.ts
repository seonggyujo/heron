// App chrome theme (styles/themes.css). The terminal is never themed.
// localStorage is a convenience only: any failure falls back to black.

export type Theme = "green" | "black";

const KEY = "heron.theme";

export function loadTheme(): Theme {
  try {
    if (localStorage.getItem(KEY) === "green") return "green";
  } catch {
    /* storage unavailable */
  }
  return "black";
}

export function applyTheme(theme: Theme): void {
  if (theme === "green") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

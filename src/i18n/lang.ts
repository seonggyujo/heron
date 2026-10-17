import { en, type Strings } from "./en";
import { ko } from "./ko";

// The UI language, English or Korean. Without a saved choice it follows the
// Windows display language (what WebView2 reports in navigator.languages).
// UI modules read their text through t() and redraw on onLangChange().
// localStorage is a convenience only: any failure falls back.

export type Lang = "en" | "ko";

const KEY = "heron.lang";
const TABLES: Record<Lang, Strings> = { en, ko };
const listeners = new Set<() => void>();

/** Korean when the system's first language is Korean, else English. */
function systemLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ko") return saved;
  } catch {
    /* storage unavailable */
  }
  return systemLang(navigator.languages.length ? navigator.languages : [navigator.language]);
}

let current: Lang = loadLang();

/** The strings of the current language. */
export function t(): Strings {
  return TABLES[current];
}

export function getLang(): Lang {
  return current;
}

/** The user picked a language: show it everywhere and remember it. */
export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable */
  }
  show(lang);
}

/** Shows the saved (or system) language, at startup and after a reset. */
export function applyLang(): void {
  show(loadLang());
}

/** Returns the unsubscribe function. */
export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function show(lang: Lang): void {
  const changed = lang !== current;
  current = lang;
  document.documentElement.lang = lang;
  if (changed) listeners.forEach((fn) => fn());
}

// Small user preferences: the ones set in the settings panel and a few the
// UI remembers on its own (agent sidebar, folded session folders). localStorage is a convenience
// only: any failure keeps the default. Theme, font size and language have
// their own modules (theme.ts, font-size.ts, i18n/lang.ts).

export interface Pref<T> {
  get(): T;
  set(value: T): void;
  /** Back to the default; the stored value is dropped by forgetSettings(). */
  reset(): void;
}

function pref<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | undefined,
  format: (value: T) => string = String,
): Pref<T> {
  let value = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) value = parse(raw) ?? fallback;
  } catch {
    /* storage unavailable */
  }
  return {
    get: () => value,
    reset: () => {
      value = fallback;
    },
    set(next) {
      value = next;
      try {
        localStorage.setItem(key, format(next));
      } catch {
        /* storage unavailable */
      }
    },
  };
}

const bool = (raw: string) => (raw === "true" ? true : raw === "false" ? false : undefined);

function strings(raw: string): string[] | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
  } catch {
    return undefined;
  }
}

/** Pane, menu and glow animations. */
export const motionPref = pref("heron.motion", true, bool);

export const HERONS_MAX = 3;
const heronCount = (raw: string) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= HERONS_MAX ? n : undefined;
};

/** Settings > Terminal herons: how many live in each agent pane, 0 for none (pane/pane-herons.ts). */
export const heronsPref = pref("heron.herons", 1, heronCount);

/** Close a terminal pane when its shell exits with code 0. */
export const closeOnExitPref = pref("heron.closeOnExit", true, bool);

/** On start, reopen the panes of the last run (wire-workspace.ts). */
export const restoreWorkspacePref = pref("heron.restoreWorkspace", true, bool);

/** The agent sidebar is folded to a rail of dots. */
export const sidebarCollapsedPref = pref("heron.sidebarCollapsed", false, bool);

/** The user closed the "install the plugin" hint in the agent sidebar. */
export const pluginHintHiddenPref = pref("heron.pluginHintHidden", false, bool);

/** The user closed the "turn on Claude Code hooks" offer in the agent sidebar. */
export const hooksOfferHiddenPref = pref("heron.hooksOfferHidden", false, bool);

/** Folders whose recent sessions the user folded (keys of agent/session-groups.ts). */
export const foldedSessionGroupsPref = pref<string[]>("heron.foldedSessionGroups", [], strings, JSON.stringify);

/** The user turned Heron's Claude Code hooks on (see app/agent-hooks.ts). */
export const agentHooksWantedPref = pref("heron.agentHooks", false, bool);

export function resetPrefs(): void {
  // agentHooksWantedPref stays: the hooks stay in Claude Code's settings.
  const prefs = [motionPref, heronsPref, closeOnExitPref, restoreWorkspacePref, sidebarCollapsedPref, pluginHintHiddenPref, hooksOfferHiddenPref];
  [...prefs, foldedSessionGroupsPref].forEach((p) => p.reset());
}

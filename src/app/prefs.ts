// Small user preferences, each under its own heron.* key: the ones set in
// the settings panel and a few the UI remembers on its own (agent sidebar,
// folded session folders). theme.ts, font-size.ts and shells.ts make theirs
// with pref() too; the language stays in i18n/lang.ts, which imports no app
// module. localStorage is a convenience only: any failure keeps the default.

export interface Pref<T> {
  get(): T;
  set(value: T): void;
}

interface PrefOptions<T> {
  format?: (value: T) => string;
  /** resetPrefs() leaves the value as it is. */
  keepOnReset?: boolean;
}

/** One entry per pref made, so a reset has no list to keep up to date. */
const resets: (() => void)[] = [];

export function pref<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | undefined,
  { format = String, keepOnReset = false }: PrefOptions<T> = {},
): Pref<T> {
  let value = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) value = parse(raw) ?? fallback;
  } catch {
    /* storage unavailable */
  }
  if (!keepOnReset) {
    resets.push(() => {
      value = fallback;
    });
  }
  return {
    get: () => value,
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
export const foldedSessionGroupsPref = pref<string[]>("heron.foldedSessionGroups", [], strings, { format: JSON.stringify });

/**
 * The user turned Heron's Claude Code hooks on (see app/agent-hooks.ts). A
 * reset leaves it in memory: the hooks stay in Claude Code's settings.
 */
export const agentHooksWantedPref = pref("heron.agentHooks", false, bool, { keepOnReset: true });

/** Settings > Reset: every pref back to its default (app/reset.ts drops the stored values). */
export function resetPrefs(): void {
  resets.forEach((reset) => reset());
}

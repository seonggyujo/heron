import { agentHooksOn, setAgentHooks } from "../app/agent-hooks";
import { fontSizePref } from "../app/font-size";
import { createLogger } from "../app/log";
import { motionEnabled, setMotion } from "../app/motion";
import { closeOnExitPref, heronsPref, restoreWorkspacePref } from "../app/prefs";
import { currentTheme, type Theme } from "../app/theme";
import { hooksErrorText } from "../i18n/hooks-error";
import { getLang, setLang, t } from "../i18n/lang";
import { createConfirmButton } from "./confirm-button";
import { createFontSizeControl } from "./font-size-control";
import { createHeronCountToggle } from "./heron-count-toggle";
import { createLangToggle } from "./lang-toggle";
import { createSwitch } from "./switch";
import { createThemeToggle } from "./theme-toggle";

// The rows of the settings panel, built from the stored values each time
// the panel opens (and after a reset), so they never show stale values.
// Every change applies at once, is remembered, and is logged.

const log = createLogger("settings");

export interface SettingsActions {
  onTheme(theme: Theme): void;
  onFontSize(px: number): void;
  /** Applies the defaults to what is on screen after the stored values were dropped. */
  onReset(): void;
}

function row(label: string, control: HTMLElement): HTMLElement {
  const el = document.createElement("div");
  el.className = "settings-row";
  const text = document.createElement("span");
  text.className = "settings-label";
  text.textContent = label;
  el.append(text, control);
  return el;
}

/** Claude Code hooks (app/agent-hooks.ts). Turning them on can fail; the reason shows under the row. */
function hooksRows(): HTMLElement[] {
  const s = t();
  const note = document.createElement("div");
  note.className = "settings-note";
  const toggle = createSwitch(s.agentHooksHint, agentHooksOn(), async (on) => {
    const code = await setAgentHooks(on);
    note.textContent = code ? hooksErrorText(code) : "";
    return code ? !on : on;
  });
  toggle.title = s.agentHooksHint;
  return [row(s.agentHooks, toggle), note];
}

/** Terminal herons per agent pane; the panes pick the change up within a second (pane/pane-herons.ts). */
function heronsRow(): HTMLElement {
  const s = t();
  const toggle = createHeronCountToggle(heronsPref.get(), s.herons, s.heronsOff, (n) => {
    log.info(`terminal herons ${n}`);
    heronsPref.set(n);
  });
  toggle.title = s.heronsHint;
  return row(s.herons, toggle);
}

function preferenceRows(actions: SettingsActions): HTMLElement[] {
  const s = t();
  return [
    row(
      s.theme,
      createThemeToggle(currentTheme(), (theme) => {
        log.info(`theme ${theme}`);
        actions.onTheme(theme);
      }),
    ),
    row(
      s.language,
      createLangToggle(getLang(), s.language, (lang) => {
        log.info(`language ${lang}`);
        setLang(lang);
      }),
    ),
    row(s.fontSize, createFontSizeControl(fontSizePref.get(), actions.onFontSize)),
    row(
      s.animations,
      createSwitch(s.animations, motionEnabled(), (on) => {
        log.info(`animations ${on ? "on" : "off"}`);
        setMotion(on);
      }),
    ),
    heronsRow(),
    row(
      s.closeOnExit,
      createSwitch(s.closeOnExitHint, closeOnExitPref.get(), (on) => {
        log.info(`close pane on exit 0 ${on ? "on" : "off"}`);
        closeOnExitPref.set(on);
      }),
    ),
    row(
      s.restoreWorkspace,
      createSwitch(s.restoreWorkspaceHint, restoreWorkspacePref.get(), (on) => {
        log.info(`reopen last work ${on ? "on" : "off"}`);
        restoreWorkspacePref.set(on);
      }),
    ),
    ...hooksRows(),
  ];
}

function dataRows(actions: SettingsActions): HTMLElement[] {
  const s = t();
  const reset = createConfirmButton(s.reset, async () => {
    log.info("settings reset to defaults");
    actions.onReset();
    return t().done;
  });
  reset.title = s.resetHint;
  return [row(s.settings, reset)];
}

export function buildRows(actions: SettingsActions): HTMLElement[] {
  const sep = document.createElement("div");
  sep.className = "settings-sep";
  return [...preferenceRows(actions), sep, ...dataRows(actions)];
}

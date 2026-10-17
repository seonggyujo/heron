import { span } from "../app/dom";
import { formatUptime } from "../app/durations";
import type { UptimeClock } from "../app/uptime-clock";
import { onLangChange, t } from "../i18n/lang";

// Pane header DOM: status dot, shell name, exit badge, current folder,
// terminal title, uptime, close button. Status lives here, never inside the
// terminal: the terminal shows only what the shell prints.

export interface PaneHeader {
  el: HTMLElement;
  /** Title set by the running program (OSC 0/2). */
  setTitle(title: string): void;
  /** Current folder reported by the shell. */
  setCwd(path: string): void;
  /** The shell started: count how long it runs, until it exits. */
  startUptime(): void;
  /** Shows the exit code, or a start failure when `code` is null. */
  showExit(code: number | null): void;
  /** Stops the uptime and following language changes. */
  dispose(): void;
}

/** Updates text only when it changed, and mirrors it into the tooltip. */
function setText(el: HTMLElement, text: string): void {
  if (el.textContent === text) return;
  el.textContent = text;
  el.title = text;
}

export function createPaneHeader(shellLabel: string, clock: UptimeClock, onClose: () => void): PaneHeader {
  const el = document.createElement("header");
  el.className = "pane-header";

  const dot = span("pane-dot");
  const shell = span("pane-shell", shellLabel);
  const exit = span("pane-exit");
  const cwd = span("pane-cwd");
  const title = span("pane-title");
  const uptime = span("pane-uptime");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "pane-close";
  close.textContent = "×";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });

  /** undefined while the shell runs, null when it failed to start. */
  let exitCode: number | null | undefined;
  const showText = () => {
    close.setAttribute("aria-label", t().closeTerminal);
    if (exitCode !== undefined) exit.textContent = exitCode === null ? t().failedToStart : t().exitCode(exitCode);
  };
  showText();
  const stopLang = onLangChange(showText);

  let stopUptime: (() => void) | null = null;
  const endUptime = () => {
    stopUptime?.();
    stopUptime = null;
  };

  el.append(dot, shell, exit, cwd, title, uptime, close);
  return {
    el,
    setTitle: (text) => setText(title, text),
    setCwd: (path) => setText(cwd, path),
    startUptime() {
      const startedAt = Date.now();
      stopUptime = clock.subscribe((now) => {
        const text = formatUptime(now - startedAt);
        if (uptime.textContent !== text) uptime.textContent = text;
      });
    },
    showExit(code) {
      endUptime();
      exitCode = code;
      exit.classList.toggle("error", code !== 0);
      showText();
    },
    dispose() {
      endUptime();
      stopLang();
    },
  };
}

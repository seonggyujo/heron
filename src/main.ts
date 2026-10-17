import "./styles/stylesheets";
import { fontSizePref } from "./app/font-size";
import { createLogger } from "./app/log";
import { applyMotion } from "./app/motion";
import { installLongTaskMonitor } from "./app/perf-monitor";
import { forgetSettings } from "./app/reset";
import { defaultShellOf, defaultShellPref, SHELL_LABELS } from "./app/shells";
import { applyTheme, setTheme } from "./app/theme";
import { UptimeClock } from "./app/uptime-clock";
import { installVisibilityTracking } from "./app/visibility";
import { applyLang } from "./i18n/lang";
import { onOpenFolder, takeLaunchDir } from "./ipc/launch";
import { listShells, type ShellKind } from "./ipc/pty";
import { showWindowMenu } from "./ipc/window-menu";
import { installFileDrop } from "./pane/file-drop";
import { PaneManager } from "./pane/pane-manager";
import { installShortcutGuard } from "./terminal/keys";
import { createEmptyState } from "./ui/empty-state";
import { keepPaneFocus } from "./ui/keep-pane-focus";
import { createNewTerminalButton } from "./ui/new-terminal-button";
import { createSettings } from "./ui/settings-panel";
import { createShellMenu } from "./ui/shell-menu";
import { installShortcuts } from "./ui/shortcuts";
import { createTerminalCount } from "./ui/terminal-count";
import { createTidyButton } from "./ui/tidy-button";
import { createTitlebar } from "./ui/titlebar";
import { wireAgents } from "./wire-agents";
import { wireNewAgent } from "./wire-new-agent";
import { wireSessions } from "./wire-sessions";
import { wireWorkspace } from "./wire-workspace";

// Bootstrap only: builds the modules and wires them to one another
// (docs/ARCHITECTURE.md has the map).

const log = createLogger("app");

async function main(): Promise<void> {
  // Before any DOM is built, so the first paint already has the theme
  // and the language.
  applyTheme();
  applyLang();
  applyMotion();
  installShortcutGuard();
  keepPaneFocus();
  await installVisibilityTracking();
  installLongTaskMonitor();

  const titlebar = createTitlebar();
  const workspace = document.createElement("main");
  workspace.id = "workspace";
  // Coding agents in the panes: their sidebar sits left of the workspace,
  // their usage bar along the bottom. The sidebar also starts new agents and
  // reopens recent sessions, with the default shell.
  const clock = new UptimeClock();
  const sessions = wireSessions(() => panes, () => defaultShell);
  const newAgent = wireNewAgent(() => panes, () => defaultShell, sessions.list);
  const agents = wireAgents(clock, () => panes, { start: newAgent.el, sessions: sessions.el }, sessions.setRunning);
  const middle = document.createElement("div");
  middle.className = "app-middle";
  middle.append(agents.sidebar, workspace);
  document.body.append(titlebar.el, middle, agents.usageBar);

  const shells = await listShells();
  let defaultShell = defaultShellOf(shells);
  log.info(`shells: ${shells.join(", ")}; default ${defaultShell}`);

  // New panes open in the folder Heron was opened on ("Open in Heron"), else home.
  const launchDir = await takeLaunchDir();
  const open = (shell: ShellKind, cwd: string | null = launchDir) => {
    panes.add(shell, cwd).catch((err) => log.error("add terminal failed", err));
  };

  const count = createTerminalCount();
  const empty = createEmptyState(() => open(defaultShell));
  workspace.append(empty.el);

  const tidy = createTidyButton(() => panes.tidy());
  const panes = new PaneManager(
    workspace,
    clock,
    fontSizePref.get(),
    (c) => {
      count.update(c);
      empty.setVisible(c.terminals === 0);
      agents.refresh();
    },
    (manual) => tidy.setVisible(manual),
    (pty, signal) => {
      agents.onSignal(pty, signal);
      if (signal.kind === "focus" || signal.kind === "prompt") newAgent.refreshFolder();
    },
  );
  await panes.init();
  await agents.start();
  sessions.start();
  // "Open in Heron" while this window runs: a new pane in that folder.
  await onOpenFolder((dir) => open(defaultShell, dir));
  await installFileDrop((x, y) => panes.paneAt(x, y));
  installShortcuts({
    newPane: () => open(defaultShell),
    focusStep: (step) => panes.focusStep(step),
    windowMenu: () => void showWindowMenu(false),
  });

  const setDefaultShell = (shell: ShellKind) => {
    defaultShell = shell;
    menu.setDefault(shell);
    newButton.setShell(SHELL_LABELS[shell]);
  };

  // The menu only selects the shell; the + button opens it.
  const menu = createShellMenu(shells, defaultShell, (shell) => {
    log.info(`default shell ${shell}`);
    defaultShellPref.set(shell);
    setDefaultShell(shell);
  });
  document.body.append(menu.el);

  const newButton = createNewTerminalButton(
    SHELL_LABELS[defaultShell],
    () => open(defaultShell),
    (anchor) => menu.toggle(anchor),
  );
  // Theme, font size and the other preferences live behind the gear.
  const settings = createSettings({
    onTheme: setTheme,
    onFontSize: (px) => {
      panes.setFontSize(px);
      fontSizePref.set(px);
    },
    onReset: () => {
      forgetSettings();
      applyTheme();
      applyLang();
      applyMotion();
      panes.setFontSize(fontSizePref.get());
      setDefaultShell(defaultShellOf(shells));
      agents.refresh();
    },
  });
  document.body.append(settings.panel);
  titlebar.actions.append(tidy.el, count.el, settings.button, newButton.el);

  // The last run's panes (Settings > Reopen last work), then "Open in Heron".
  await wireWorkspace(panes, clock, shells, agents.sessionOf).open(defaultShell, launchDir);
  log.info("ready");
}

main().catch((err) => log.error("startup failed", err));

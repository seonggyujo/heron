import { doingOf } from "./agent/activity";
import { AgentBoard } from "./agent/agent-board";
import { markOf, wantsAttention, type Agent } from "./agent/agent-model";
import { syncAgentHooks } from "./app/agent-hooks";
import { createLogger } from "./app/log";
import { folderLabel } from "./app/paths";
import type { UptimeClock } from "./app/uptime-clock";
import { onLangChange } from "./i18n/lang";
import { onAgentUpdate } from "./ipc/agent";
import { flashTaskbar } from "./ipc/attention";
import type { Pane } from "./pane/pane";
import type { PaneDoing } from "./pane/pane-header";
import type { PaneManager } from "./pane/pane-manager";
import { markAgent, markHover, type PaneSignal } from "./pane/pane-signals";
import { doingText } from "./ui/agent-activity";
import type { AgentRow } from "./ui/agent-item";
import { createAgentSidebar, type SidebarParts } from "./ui/agent-sidebar";
import { createTaskbarStatus } from "./ui/taskbar-status";
import { createUsageBar } from "./ui/usage-bar";
import { GitWatch, type WatchedFolder } from "./wire-git";

// Wiring only, like main.ts: agent updates and pane signals go into the
// agent board; every change of the board redraws the sidebar (with each
// folder's branch and uncommitted changes from wire-git.ts), the usage bar,
// the pane dots, the panes' headers (the branch, what a working agent does)
// and terminal herons, and the taskbar button's bar and number. A prompt
// asks its folder's branch again. An agent that needs the
// user or finishes flashes the taskbar button. The sidebar also holds the
// "New agent" button and the recent sessions, which hear which sessions run
// in panes.

const log = createLogger("attention");

export interface AgentWiring {
  /** The sidebar, to place left of the workspace. */
  sidebar: HTMLElement;
  /** The usage bar, to place along the bottom of the window. */
  usageBar: HTMLElement;
  onSignal(pty: number, signal: PaneSignal): void;
  /** Panes were added, closed or renamed: redraw. */
  refresh(): void;
  /** The Claude Code session in the pane with pty id `pty`, when the hooks told it. */
  sessionOf(pty: number): string | null;
  /** Starts listening to the agent files and checks Heron's Claude Code hooks. */
  start(): Promise<void>;
}

/** What a working agent does now, for its pane's header. */
function doingFor(agent: Agent | undefined): PaneDoing | null {
  const step = agent?.state === "working" ? agent.activity?.step : null;
  return step ? { text: doingText(step), kind: doingOf(step) } : null;
}

/**
 * `panes` is read lazily: the pane manager is built after this.
 * `onRunning` hears the ids of the sessions running in panes.
 */
export function wireAgents(
  clock: UptimeClock,
  panes: () => PaneManager,
  parts: SidebarParts,
  onRunning: (ids: string[]) => void,
): AgentWiring {
  const board = new AgentBoard();
  const byPty = (pty: number) => panes().terminals().find((p) => p.id === pty);
  // A click focuses that pane and counts as having seen it.
  const pick = (pty: number) => {
    byPty(pty)?.focus();
    board.seen(pty);
  };
  const sidebar = createAgentSidebar(
    clock,
    {
      onPick: pick,
      onHover(pty) {
        for (const p of panes().terminals()) markHover(p.el, p.id !== null && p.id === pty);
      },
    },
    parts,
  );
  const usageBar = createUsageBar(clock, pick);
  const taskbar = createTaskbarStatus();
  const git = new GitWatch(clock, () => refresh());
  /** A pane header's branch is its folder's, the shell's. */
  const showBranch = (p: Pane) => p.showBranch(p.path ? git.branchOf(p.path) : null);

  const refresh = () => {
    const terminals = panes().terminals();
    const rows: AgentRow[] = terminals.flatMap((p, i) => {
      const agent = p.id === null ? undefined : board.get(p.id);
      if (!agent || p.id === null) return [];
      // The agent's own folder when the hooks report it, else the shell's.
      const path = agent.cwd ?? p.path;
      const folder = (path && folderLabel(path)) ?? p.folder;
      const [changes, branch] = path ? [git.changesOf(path), git.branchOf(path)] : [null, null];
      return [{ pty: p.id, number: i + 1, folder, path, agent, changes, branch }];
    });
    sidebar.render(rows, board.pluginSeen);
    usageBar.render(rows, board.limits);
    taskbar.render(rows.map((r) => r.agent.state));
    onRunning(rows.flatMap((r) => (r.agent.sessionId ? [r.agent.sessionId] : [])));
    const watched: WatchedFolder[] = [];
    for (const p of terminals) {
      const agent = p.id === null ? undefined : board.get(p.id);
      markAgent(p.el, agent ? markOf(agent.state) : null);
      p.showAgent(agent ?? null, doingFor(agent));
      showBranch(p);
      const folder = agent?.cwd ?? p.path;
      if (p.id !== null && folder) watched.push({ pty: p.id, folder, state: agent?.state ?? null });
    }
    git.watch(watched);
  };
  board.subscribe((change) => {
    refresh();
    if (!wantsAttention(change.from, change.to)) return;
    flashTaskbar().catch((err) => log.warn("taskbar flash failed", err));
  });
  // The headers' words follow the language.
  onLangChange(refresh);

  return {
    sidebar: sidebar.el,
    usageBar: usageBar.el,
    refresh,
    sessionOf: (pty) => board.get(pty)?.sessionId ?? null,
    onSignal(pty, signal) {
      switch (signal.kind) {
        case "title":
          return board.title(pty, signal.title);
        case "key":
          return board.input(pty, signal.interrupt);
        case "focus":
          return board.seen(pty);
        case "prompt": {
          // A cd may have left the branch the header shows: it takes the new folder's at once.
          const pane = byPty(pty);
          if (pane?.path) void git.askBranch(pane.path).then(() => showBranch(pane));
          return board.remove(pty);
        }
        case "closed":
          return board.forget(pty);
      }
    },
    async start() {
      await onAgentUpdate((update) => board.update(update));
      // Not awaited: putting hooks back runs `claude --version`.
      void syncAgentHooks();
    },
  };
}

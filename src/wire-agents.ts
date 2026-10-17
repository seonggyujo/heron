import { AgentBoard } from "./agent/agent-board";
import { markOf, wantsAttention } from "./agent/agent-model";
import { syncAgentHooks } from "./app/agent-hooks";
import { createLogger } from "./app/log";
import { folderLabel } from "./app/paths";
import type { UptimeClock } from "./app/uptime-clock";
import { onAgentUpdate } from "./ipc/agent";
import { flashTaskbar } from "./ipc/attention";
import type { PaneManager } from "./pane/pane-manager";
import { markAgent, markHover, type PaneSignal } from "./pane/pane-signals";
import type { AgentRow } from "./ui/agent-item";
import { createAgentSidebar, type SidebarParts } from "./ui/agent-sidebar";
import { createUsageBar } from "./ui/usage-bar";
import { ChangeWatch } from "./wire-changes";

// Wiring only, like main.ts: agent updates and pane signals go into the
// agent board; every change of the board redraws the sidebar (with each
// folder's uncommitted changes from wire-changes.ts), the usage bar, the
// pane dots and the panes' terminal herons, and an agent that needs the user or finishes flashes the
// taskbar button. The sidebar also holds the "New agent" button and the
// recent sessions, which hear which sessions run in panes.

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
  const changes = new ChangeWatch(clock, () => refresh());

  const refresh = () => {
    const terminals = panes().terminals();
    const rows: AgentRow[] = terminals.flatMap((p, i) => {
      const agent = p.id === null ? undefined : board.get(p.id);
      if (!agent || p.id === null) return [];
      // The agent's own folder when the hooks report it, else the shell's.
      const path = agent.cwd ?? p.path;
      const folder = (path && folderLabel(path)) ?? p.folder;
      return [{ pty: p.id, number: i + 1, folder, path, agent, changes: path ? changes.of(path) : null }];
    });
    sidebar.render(rows, board.pluginSeen);
    usageBar.render(rows, board.limits);
    changes.watch(rows.flatMap((r) => (r.path ? [{ pty: r.pty, folder: r.path, state: r.agent.state }] : [])));
    onRunning(rows.flatMap((r) => (r.agent.sessionId ? [r.agent.sessionId] : [])));
    for (const p of terminals) {
      const agent = p.id === null ? undefined : board.get(p.id);
      markAgent(p.el, agent ? markOf(agent.state) : null);
      p.showAgent(agent ?? null);
    }
  };
  board.subscribe((change) => {
    refresh();
    if (!wantsAttention(change.from, change.to)) return;
    flashTaskbar().catch((err) => log.warn("taskbar flash failed", err));
  });

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
        case "prompt":
          return board.remove(pty);
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

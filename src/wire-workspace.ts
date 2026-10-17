import { resumeCommand, startCommand } from "./app/claude-commands";
import { createLogger } from "./app/log";
import { restoreWorkspacePref } from "./app/prefs";
import type { UptimeClock } from "./app/uptime-clock";
import { parseWorkspace, type SavedPane, type SavedWorkspace } from "./app/workspace";
import { readWorkspace, writeWorkspace } from "./app/workspace-store";
import type { ShellKind } from "./ipc/pty";
import { resumableSessions } from "./ipc/sessions";
import type { PaneManager } from "./pane/pane-manager";

// Wiring only, like main.ts: the work of the last run. At start (Settings >
// Reopen last work) the saved panes open again, each with its shell in its
// folder, then the user's own arrangement. A pane that ran Claude Code
// resumes its session, or starts a new one when that cannot be resumed
// (never saved because it got no message, or running elsewhere now). While
// the app runs, every clock tick saves what is open when it changed.

const log = createLogger("workspace");

export interface WorkspaceWiring {
  /**
   * The first panes: the saved ones, then one in `launchDir` ("Open in
   * Heron"), or one in the home folder when nothing else opened.
   */
  open(shell: ShellKind, launchDir: string | null): Promise<void>;
}

export function wireWorkspace(
  panes: PaneManager,
  clock: UptimeClock,
  shells: readonly ShellKind[],
  /** The Claude Code session in the pane with pty id `pty`, if known. */
  sessionOf: (pty: number) => string | null,
): WorkspaceWiring {
  const snapshot = (): SavedWorkspace => ({
    panes: panes.terminals().map(
      (p): SavedPane => ({ shell: p.shell, cwd: p.path, session: p.id === null ? null : sessionOf(p.id) }),
    ),
    layout: panes.layoutShape(),
  });
  const save = () => {
    const json = JSON.stringify(snapshot());
    if (json !== readWorkspace()) writeWorkspace(json);
  };

  const reopen = async (saved: SavedWorkspace) => {
    const ids = saved.panes.flatMap((p) => (p.session ? [p.session] : []));
    const resumable = new Set(await resumableSessions(ids).catch(() => [] as string[]));
    const command = (session: string | null) => {
      if (!session) return undefined;
      return (resumable.has(session) && resumeCommand(session)) || startCommand(false);
    };
    // All panes and their arrangement first, then every shell at once at its final size.
    const opened = panes.insertAll(saved.panes.map((p) => ({ shell: p.shell, cwd: p.cwd, run: command(p.session) })));
    const arranged = saved.layout !== null && panes.restoreLayout(saved.layout);
    await panes.startAll(opened);
    log.info(`reopened ${saved.panes.length} panes, ${resumable.size}/${ids.length} sessions resumed${arranged ? ", own layout" : ""}`);
  };

  return {
    async open(shell, launchDir) {
      const saved = restoreWorkspacePref.get() ? parseWorkspace(readWorkspace(), shells, shell) : null;
      if (saved && saved.panes.length > 0) await reopen(saved);
      if (launchDir || panes.terminals().length === 0) await panes.add(shell, launchDir);
      clock.subscribe(save);
    },
  };
}

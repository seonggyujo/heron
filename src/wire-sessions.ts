import { resumeCommand } from "./app/claude-commands";
import { createLogger } from "./app/log";
import type { ShellKind } from "./ipc/pty";
import { deleteSession, recentSessions, type RecentSession } from "./ipc/sessions";
import type { PaneManager } from "./pane/pane-manager";
import { createRecentSessions } from "./ui/recent-sessions";

// Wiring only, like main.ts: the recent Claude Code sessions in the agent
// sidebar. A click opens a pane with the default shell in the folder the
// session last ran in and types `claude --resume <id>` at its first prompt;
// a session can also be moved to the Recycle Bin. The list is read again
// when the window gets focus and when an agent's session leaves its pane
// (the backend reads only the files that changed), and redrawn only when it
// differs; sessions running in a pane are left out.

const log = createLogger("sessions");

export interface SessionWiring {
  /** The recent sessions, for the sidebar. */
  el: HTMLElement;
  /** The sessions read last, newest first. */
  list(): readonly RecentSession[];
  /** Ids of the sessions running in panes now. */
  setRunning(ids: string[]): void;
  /** Reads the recent sessions now and whenever the window gets focus. */
  start(): void;
}

export function wireSessions(panes: () => PaneManager, shell: () => ShellKind): SessionWiring {
  let sessions: RecentSession[] = [];
  let running = new Set<string>();

  const recent = createRecentSessions({
    open(session) {
      const command = resumeCommand(session.id);
      if (!command) return;
      log.info(`open "${command}" in ${session.cwd}`);
      panes().add(shell(), session.cwd, command).catch((err) => log.error("open failed", err));
    },
    remove(session) {
      return deleteSession(session.id).then(
        () => {
          sessions = sessions.filter((s) => s.id !== session.id);
          draw();
          return null;
        },
        (err) => {
          log.warn(`deleting ${session.id} failed: ${err}`);
          return String(err);
        },
      );
    },
  });

  const draw = () => recent.render(sessions.filter((s) => !running.has(s.id)));
  const load = () => {
    recentSessions()
      .then((list) => {
        if (JSON.stringify(list) === JSON.stringify(sessions)) return;
        sessions = list;
        draw();
      })
      .catch((err) => log.warn("reading recent sessions failed", err));
  };

  return {
    el: recent.el,
    list: () => sessions,
    setRunning(ids) {
      const next = new Set(ids);
      const left = [...running].some((id) => !next.has(id));
      const changed = left || ids.some((id) => !running.has(id));
      running = next;
      // A session that left its pane was just written: read the list again.
      if (left) load();
      else if (changed) draw();
    },
    start() {
      load();
      window.addEventListener("focus", load);
    },
  };
}

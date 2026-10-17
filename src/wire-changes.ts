import type { AgentState } from "./agent/agent-model";
import { folderKey } from "./agent/session-groups";
import { createLogger } from "./app/log";
import type { UptimeClock } from "./app/uptime-clock";
import { gitChanges, type Changes } from "./ipc/folders";

// How far each agent's folder is from its last commit, for the sidebar
// rows of wire-agents.ts: asks git through ipc/folders.ts and keeps the
// answers. A folder is asked again when its agent's state changes, when the
// window gets focus (unless it was asked moments ago), and every 15 s while
// its agent works; an answer that differs asks for a redraw.

const log = createLogger("changes");

const WHILE_WORKING_MS = 15_000;
/** Alt+Tab back and forth asks a folder at most this often. */
const ON_FOCUS_MS = 10_000;

/** An agent row's pane, folder and state. */
export interface WatchedAgent {
  pty: number;
  folder: string;
  state: AgentState;
}

export class ChangeWatch {
  private agents: WatchedAgent[] = [];
  private readonly states = new Map<number, AgentState>();
  private readonly known = new Map<string, Changes | null>();
  private readonly askedAt = new Map<string, number>();
  private readonly busy = new Set<string>();
  /** Asked while busy: ask once more when the answer comes. */
  private readonly again = new Set<string>();
  private readonly ticking: (on: boolean) => void;

  constructor(
    clock: UptimeClock,
    private readonly onChange: () => void,
  ) {
    this.ticking = clock.switchFor((now) => this.tick(now));
    window.addEventListener("focus", () => this.askOlderThan(ON_FOCUS_MS, Date.now()));
  }

  /** Null until git answered, and outside a repository. */
  of(folder: string): Changes | null {
    return this.known.get(folderKey(folder)) ?? null;
  }

  /** The agents now; asks git about the folders whose agent changed state. */
  watch(agents: WatchedAgent[]): void {
    this.agents = agents;
    for (const pty of [...this.states.keys()]) {
      if (!agents.some((a) => a.pty === pty)) this.states.delete(pty);
    }
    for (const a of agents) {
      if (this.states.get(a.pty) === a.state) continue;
      this.states.set(a.pty, a.state);
      this.ask(a.folder);
    }
    this.ticking(agents.some((a) => a.state === "working"));
  }

  private tick(now: number): void {
    this.askOlderThan(WHILE_WORKING_MS, now, "working");
  }

  /** Asks again about the folders (of agents in `state`, or all) last asked `ms` or more ago. */
  private askOlderThan(ms: number, now: number, state?: AgentState): void {
    for (const a of this.agents) {
      if ((!state || a.state === state) && now - (this.askedAt.get(folderKey(a.folder)) ?? 0) >= ms) this.ask(a.folder);
    }
  }

  private ask(folder: string): void {
    const key = folderKey(folder);
    if (this.busy.has(key)) {
      this.again.add(key);
      return;
    }
    this.busy.add(key);
    this.askedAt.set(key, Date.now());
    gitChanges(folder)
      .then((changes) => {
        const differs = JSON.stringify(changes) !== JSON.stringify(this.known.get(key) ?? null);
        this.known.set(key, changes);
        if (differs) this.onChange();
      })
      .catch((err) => log.warn(`git changes of ${folder} failed`, err))
      .finally(() => {
        this.busy.delete(key);
        if (this.again.delete(key)) this.ask(folder);
      });
  }
}

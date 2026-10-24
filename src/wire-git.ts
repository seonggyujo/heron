import type { AgentState } from "./agent/agent-model";
import { folderKey } from "./agent/session-groups";
import { createLogger } from "./app/log";
import type { UptimeClock } from "./app/uptime-clock";
import { gitBranch, gitChanges, type Changes } from "./ipc/folders";

// What git says about the panes' folders, for wire-agents.ts: the branch of
// each folder (pane headers and agent rows) and how far an agent's folder is
// from its last commit (agent rows). Asks through ipc/folders.ts and keeps
// the answers; an answer that differs asks for a redraw. A folder's branch
// is asked at each prompt there, as a git command may have switched it. A
// pane's folder is asked again (its changes too when an agent is in it)
// when the pane is new or its agent's state changes, when the window gets
// focus (an agent's folder not when it was asked moments ago), and every
// 15 s while its agent works.

const log = createLogger("git");

const WHILE_WORKING_MS = 15_000;
/** Alt+Tab back and forth asks an agent's folder at most this often. */
const ON_FOCUS_MS = 10_000;

/** A pane's folder (its agent's, if it has one) and its agent's state. */
export interface WatchedFolder {
  pty: number;
  folder: string;
  /** Null without an agent. */
  state: AgentState | null;
}

export class GitWatch {
  private watched: WatchedFolder[] = [];
  private readonly states = new Map<number, AgentState | null>();
  private readonly changes = new Map<string, Changes | null>();
  private readonly branches = new Map<string, string | null>();
  /** When each folder's changes were last asked. */
  private readonly askedAt = new Map<string, number>();
  private readonly busy = new Set<string>();
  /** Asked while busy: ask once more when the answer comes. */
  private readonly again = new Set<string>();
  /** The latest branch ask of each folder: an earlier one answering later is dropped. */
  private readonly branchAsks = new Map<string, number>();
  private readonly ticking: (on: boolean) => void;

  constructor(
    clock: UptimeClock,
    private readonly onChange: () => void,
  ) {
    this.ticking = clock.switchFor((now) => this.tick(now));
    window.addEventListener("focus", () => this.askOlderThan(ON_FOCUS_MS, Date.now()));
  }

  /** Null until git answered, and outside a repository. */
  changesOf(folder: string): Changes | null {
    return this.changes.get(folderKey(folder)) ?? null;
  }

  /** Null until git answered, and outside a repository. */
  branchOf(folder: string): string | null {
    return this.branches.get(folderKey(folder)) ?? null;
  }

  /** The panes' folders now; asks git about those whose pane is new or whose agent changed state. */
  watch(folders: WatchedFolder[]): void {
    this.watched = folders;
    for (const pty of [...this.states.keys()]) {
      if (!folders.some((f) => f.pty === pty)) this.states.delete(pty);
    }
    for (const f of folders) {
      if (this.states.has(f.pty) && this.states.get(f.pty) === f.state) continue;
      this.states.set(f.pty, f.state);
      this.ask(f);
    }
    this.ticking(folders.some((f) => f.state === "working"));
  }

  /** The branch of `folder`, asked again (after a prompt there); resolves once it is kept. */
  askBranch(folder: string): Promise<void> {
    const key = folderKey(folder);
    const ask = (this.branchAsks.get(key) ?? 0) + 1;
    this.branchAsks.set(key, ask);
    return gitBranch(folder)
      .then((branch) => {
        if (this.branchAsks.get(key) === ask) this.keep(this.branches, key, branch);
      })
      .catch((err) => log.warn(`git branch of ${folder} failed`, err));
  }

  private tick(now: number): void {
    this.askOlderThan(WHILE_WORKING_MS, now, "working");
  }

  /** Asks again about the folders (of agents in `state`, or all) whose changes were last asked `ms` or more ago. */
  private askOlderThan(ms: number, now: number, state?: AgentState): void {
    for (const f of this.watched) {
      if ((!state || f.state === state) && now - (this.askedAt.get(folderKey(f.folder)) ?? 0) >= ms) this.ask(f);
    }
  }

  private ask(f: WatchedFolder): void {
    void this.askBranch(f.folder);
    if (f.state !== null) this.askChanges(f.folder);
  }

  private askChanges(folder: string): void {
    const key = folderKey(folder);
    if (this.busy.has(key)) {
      this.again.add(key);
      return;
    }
    this.busy.add(key);
    this.askedAt.set(key, Date.now());
    gitChanges(folder)
      .then((changes) => this.keep(this.changes, key, changes))
      .catch((err) => log.warn(`git changes of ${folder} failed`, err))
      .finally(() => {
        this.busy.delete(key);
        if (this.again.delete(key)) this.askChanges(folder);
      });
  }

  /** Keeps an answer; one that differs from the last asks for a redraw. */
  private keep<T>(answers: Map<string, T | null>, key: string, answer: T | null): void {
    const differs = JSON.stringify(answer) !== JSON.stringify(answers.get(key) ?? null);
    answers.set(key, answer);
    if (differs) this.onChange();
  }
}

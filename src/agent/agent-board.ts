import { createLogger } from "../app/log";
import type { AgentUpdate } from "../ipc/agent";
import { applyInput, applySeen, applyState, applyTitle, type Agent, type AgentState } from "./agent-model";
import { applyActivity, applyCheck, applyStatus, applySubagents, applyTokens } from "./agent-reports";
import { limitsOf, sameLimits, type Limits } from "./usage";

// The agents of all panes, keyed by pty id, and the newest usage limits.
// Every signal goes through the pure functions in agent-model.ts,
// agent-reports.ts and usage.ts; listeners hear about any change. The backend sends the model
// check, the subagents, the activity and the tokens only when they change, so the last
// of each is kept per pane and given to an agent that starts there again.

/** The updates the backend sends only when they change. */
const REPORTS = ["check", "subagents", "activity", "tokens"] as const;
type Report = (typeof REPORTS)[number];

/** What changed for one pane; a state is null while the pane has no agent. */
export interface AgentChange {
  pty: number;
  from: AgentState | null;
  to: AgentState | null;
}

const log = createLogger("agents");

export class AgentBoard {
  private readonly agents = new Map<number, Agent>();
  private latestLimits: Limits | null = null;
  private statusSeen = false;
  /** The last of each report (REPORTS) per pane, agent or not. */
  private readonly lastReports = new Map<number, Partial<Record<Report, unknown>>>();
  private readonly listeners = new Set<(change: AgentChange) => void>();

  get limits(): Limits | null {
    return this.latestLimits;
  }

  /** A status file of the heron-limits plugin has come, with limits or not. */
  get pluginSeen(): boolean {
    return this.statusSeen;
  }

  get(pty: number): Agent | undefined {
    return this.agents.get(pty);
  }

  /** What the hooks, the plugin or the backend (model check, activity) reported for a pane. */
  update({ pty, kind, data }: AgentUpdate): void {
    const now = Date.now();
    const prev = this.agents.get(pty);
    if (kind === "status") {
      // The plugin writes its file on every status line refresh: only a
      // change worth showing is announced.
      const firstSeen = !this.statusSeen;
      this.statusSeen = true;
      const limits = limitsOf(data);
      const newer = limits !== null && (!this.latestLimits || limits.at >= this.latestLimits.at);
      const moved = newer && !sameLimits(limits, this.latestLimits);
      if (newer) this.latestLimits = limits;
      if (!this.set(pty, applyStatus(prev, data, now)) && (firstSeen || moved)) this.announce(pty);
    } else if (kind !== "state") {
      this.lastReports.set(pty, { ...this.lastReports.get(pty), [kind]: data });
      this.set(pty, this.withReport(prev, kind, data, now));
    } else {
      this.set(pty, applyState(prev, data, now));
    }
  }

  title(pty: number, title: string): void {
    this.set(pty, applyTitle(this.agents.get(pty), title, Date.now()));
  }

  input(pty: number, interrupt: boolean): void {
    const a = this.agents.get(pty);
    if (a) this.set(pty, applyInput(a, Date.now(), interrupt));
  }

  seen(pty: number): void {
    const a = this.agents.get(pty);
    if (a) this.set(pty, applySeen(a, Date.now()));
  }

  /** The shell drew its prompt again: no agent there now. */
  remove(pty: number): void {
    this.set(pty, null);
  }

  /** The pane closed: its agent and what was last reported for it go. */
  forget(pty: number): void {
    this.lastReports.delete(pty);
    this.set(pty, null);
  }

  /** Returns the unsubscribe function. */
  subscribe(fn: (change: AgentChange) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Keeps `next` as pane `pty`'s agent; false when nothing changed. */
  private set(pty: number, next: Agent | null | undefined): boolean {
    const prev = this.agents.get(pty);
    if (next === prev || (next === undefined && prev === undefined)) return false;
    if (next && !prev) next = this.withLastReports(pty, next);
    if (next) this.agents.set(pty, next);
    else if (prev) this.agents.delete(pty);
    else return false;
    const change: AgentChange = { pty, from: prev?.state ?? null, to: next?.state ?? null };
    if (change.from !== change.to) log.debug(`pty ${pty}: ${change.from ?? "none"} -> ${change.to ?? "none"}`);
    this.listeners.forEach((fn) => fn(change));
    return true;
  }

  /** Something besides the agents changed (limits, the plugin was seen): listeners redraw. */
  private announce(pty: number): void {
    const state = this.agents.get(pty)?.state ?? null;
    this.listeners.forEach((fn) => fn({ pty, from: state, to: state }));
  }

  /** One of the reports kept per pane, applied to the pane's agent (none: nothing to apply to). */
  private withReport(agent: Agent | undefined, kind: Report, data: unknown, now: number): Agent | undefined {
    if (kind === "check") return applyCheck(agent, data);
    if (kind === "subagents") return applySubagents(agent, data, now);
    return kind === "activity" ? applyActivity(agent, data) : applyTokens(agent, data);
  }

  /** A new agent of pane `pty` with the reports last made there. */
  private withLastReports(pty: number, agent: Agent): Agent {
    const last = this.lastReports.get(pty) ?? {};
    const now = Date.now();
    return REPORTS.reduce((a, kind) => (last[kind] === undefined ? a : (this.withReport(a, kind, last[kind], now) ?? a)), agent);
  }
}

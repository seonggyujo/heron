// What Heron knows about the coding agent (Claude Code) in one pane, and
// how its state changes. Pure: no DOM, no IPC. The state comes from:
//   - Heron's hooks (exact, ipc/agent.ts "state")
//   - the terminal title (rough): "✳ <title>" idle, a turning half circle working
//   - keys typed in the pane, and the pane getting focus
// Once a hook has reported for a pane, hooks decide the state. What the
// backend and the plugin report besides (subagents, model check, activity,
// tokens, context use) is applied by agent-reports.ts.

import { fieldsOf, textOf } from "../app/unchecked";
import type { Activity } from "./activity";
import type { Subagent } from "./subagents";
import type { TokenReport } from "./tokens";

export type AgentState = "idle" | "working" | "permission" | "question" | "waiting" | "done";
export type CheckState = "ok" | "mismatch" | "pending";

export interface ModelCheck {
  state: CheckState;
  selected: string | null;
  actual: string | null;
}

export interface Agent {
  state: AgentState;
  /** When the state began (ms), for "working 2:14". */
  since: number;
  /** A hook has reported for this pane. */
  fromHooks: boolean;
  /** Session title from the terminal title. */
  title: string | null;
  /** Notification text, e.g. which tool needs permission. */
  message: string | null;
  check: ModelCheck | null;
  /** Percent of the context window in use (heron-limits plugin). */
  context: number | null;
  /** The agent's working folder (from the hooks). */
  cwd: string | null;
  /** Claude Code's session id (from the hooks): left out of the recent sessions, resumed after a restart. */
  sessionId: string | null;
  /** Subagents running now (from the hooks), oldest first. */
  subagents: Subagent[];
  /** What it is doing, from its transcript (needs the hooks, which name the transcript). */
  activity: Activity | null;
  /** The tokens it used, from its transcript (needs the hooks too). */
  tokens: TokenReport | null;
}

const STATES: readonly AgentState[] = ["idle", "working", "permission", "question", "waiting", "done"];
const WORKING_TITLE = /^[◐◓◑◒]\s+(.*)$/u;
const IDLE_TITLE = /^✳\s+(.*)$/u;

/** An agent seen for the first time, idle until a signal says more. */
export const newAgent = (now: number): Agent => ({
  state: "idle",
  since: now,
  fromHooks: false,
  title: null,
  message: null,
  check: null,
  context: null,
  cwd: null,
  sessionId: null,
  subagents: [],
  activity: null,
  tokens: null,
});

function withState(a: Agent, state: AgentState, now: number): Agent {
  return a.state === state ? a : { ...a, state, since: now };
}

/** Hook state file. Null when the session ended. */
export function applyState(prev: Agent | undefined, data: unknown, now: number): Agent | null | undefined {
  const d = fieldsOf(data);
  if (d.state === "ended") return null;
  const state = STATES.find((s) => s === d.state);
  if (!state) return prev;
  const a = withState({ ...(prev ?? newAgent(now)), fromHooks: true }, state, now);
  return { ...a, message: textOf(d.message), cwd: textOf(d.cwd) ?? a.cwd, sessionId: textOf(d.session_id) ?? a.sessionId };
}

/** Claude Code's terminal title, or null for any other title. */
export function readTitle(title: string): { working: boolean; title: string } | null {
  const working = WORKING_TITLE.exec(title);
  if (working) return { working: true, title: working[1] };
  const idle = IDLE_TITLE.exec(title);
  return idle ? { working: false, title: idle[1] } : null;
}

export function applyTitle(prev: Agent | undefined, title: string, now: number): Agent | undefined {
  const read = readTitle(title);
  if (!read) return prev;
  const base = prev ?? newAgent(now);
  // xterm reports every title it gets, the same one again too.
  const a = base.title === read.title ? base : { ...base, title: read.title };
  if (a.fromHooks) return a;
  if (read.working) return withState(a, "working", now);
  return withState(a, a.state === "working" || a.state === "done" ? "done" : "idle", now);
}

/**
 * The user typed in the pane: an answered permission or question means work
 * goes on. Esc or Ctrl+C stops the turn, and Claude Code runs no Stop hook
 * for a stopped turn, so only the key tells that the agent is idle again.
 */
export function applyInput(a: Agent, now: number, interrupt: boolean): Agent {
  if (interrupt && (a.state === "working" || a.state === "permission")) return withState(a, "idle", now);
  return a.state === "permission" || a.state === "question" ? withState(a, "working", now) : a;
}

/** Sort key, most urgent first: needs you, finished, working, idle. */
export function urgency(state: AgentState): number {
  return { permission: 0, question: 0, waiting: 1, done: 1, working: 2, idle: 3 }[state];
}

/** How a state looks: green while working, yellow when it needs you, blue when done. */
export type AgentMark = "work" | "need" | "done" | "idle";

export function markOf(state: AgentState): AgentMark {
  if (state === "working") return "work";
  if (state === "permission" || state === "question") return "need";
  if (state === "done" || state === "waiting") return "done";
  return "idle";
}

/** Worth a taskbar flash: the agent now needs the user, or just finished its turn. */
export function wantsAttention(from: AgentState | null, to: AgentState | null): boolean {
  if (to !== "permission" && to !== "question" && to !== "done") return false;
  return from === null || markOf(from) !== markOf(to);
}

/** The pane got focus: a finished turn has been seen. */
export function applySeen(a: Agent, now: number): Agent {
  return a.state === "done" || a.state === "waiting" ? withState(a, "idle", now) : a;
}

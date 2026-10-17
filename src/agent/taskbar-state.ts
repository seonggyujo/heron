import { markOf, type AgentState } from "./agent-model";

// What Heron's taskbar button says about all the agents in its panes, so
// it is seen with Heron behind other windows: a moving bar while any works,
// a full yellow bar while one needs the user (that wins), and how many work,
// as a number over the icon. Pure.

/** The taskbar button's progress bar. */
export type TaskbarBar = "none" | "working" | "needs";

export interface TaskbarState {
  bar: TaskbarBar;
  /** Agents working now, for the number over the icon. */
  working: number;
}

export function taskbarOf(states: readonly AgentState[]): TaskbarState {
  const marks = states.map(markOf);
  const working = marks.filter((m) => m === "work").length;
  const bar: TaskbarBar = marks.includes("need") ? "needs" : working > 0 ? "working" : "none";
  return { bar, working };
}

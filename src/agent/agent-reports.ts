// What the backend and the heron-limits plugin report about a pane's agent
// besides its state (agent-model.ts), each applied to the agent: context
// use, the subagents running, the model check, the activity and the tokens.
// Pure.

import { fieldsOf, textOf } from "../app/unchecked";
import { activityOf } from "./activity";
import { newAgent, type Agent } from "./agent-model";
import { subagentsOf } from "./subagents";
import { tokensOf } from "./tokens";
import { contextOf } from "./usage";

/** The plugin's status line file: context use. Its limits: usage.ts. */
export function applyStatus(prev: Agent | undefined, data: unknown, now: number): Agent {
  const context = contextOf(data);
  return prev && prev.context === context ? prev : { ...(prev ?? newAgent(now)), context };
}

/** The subagents running now. Only for a pane that has an agent. */
export function applySubagents(prev: Agent | undefined, data: unknown, now: number): Agent | undefined {
  return prev && { ...prev, subagents: subagentsOf(data, now) };
}

/** What the backend read from the transcript. Only for a pane that has an agent. */
export function applyActivity(prev: Agent | undefined, data: unknown): Agent | undefined {
  return prev && { ...prev, activity: activityOf(data) };
}

/** The tokens the backend counted in the transcript. Only for a pane that has an agent. */
export function applyTokens(prev: Agent | undefined, data: unknown): Agent | undefined {
  return prev && { ...prev, tokens: tokensOf(data) };
}

/** The model check of the backend (src-tauri/src/agent). Only for a pane that has an agent. */
export function applyCheck(prev: Agent | undefined, data: unknown): Agent | undefined {
  if (!prev) return prev;
  const c = fieldsOf(data);
  const state = (["ok", "mismatch", "pending"] as const).find((s) => s === c.state);
  return { ...prev, check: state ? { state, selected: textOf(c.selected), actual: textOf(c.actual) } : null };
}

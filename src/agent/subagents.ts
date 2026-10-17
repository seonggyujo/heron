// The subagents an agent runs right now (pure), from the backend's list
// (src-tauri/src/agent/subagents.rs): Heron's hooks keep one entry per
// subagent from its start to its stop.

import { fieldsOf, numberOf, textOf } from "../app/unchecked";

export interface Subagent {
  id: string;
  /** The subagent's type, e.g. "Explore"; "agent" when Claude Code gave none. */
  type: string;
  /** Start (ms since 1970). */
  since: number;
}

/** Oldest first; entries without an id are dropped. */
export function subagentsOf(data: unknown, now: number): Subagent[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const r = fieldsOf(item);
    const id = textOf(r.id);
    return id ? [{ id, type: textOf(r.type) ?? "agent", since: numberOf(r.started) ?? now }] : [];
  });
}

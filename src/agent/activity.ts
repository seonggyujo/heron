// What the agent in a pane is doing, from the backend's reading of its
// transcript (src-tauri/src/agent/activity.rs): the step it is on and the
// tools it ran in this turn. Each tool falls into a kind, which picks its
// color in the sidebar and how the terminal herons act. Pure.

import { fieldsOf, numberOf, textOf } from "../app/unchecked";

/** What a tool does. */
export type ToolKind = "read" | "search" | "edit" | "run" | "web" | "agent" | "other";

/** What the agent does now: thinks, writes its answer, or runs a tool of a kind. */
export type Doing = "think" | "write" | ToolKind;

export interface ToolCall {
  tool: string;
  /** What it works on: a file name, a command, a pattern. */
  target: string | null;
  /** When it started (ms since 1970). */
  at: number;
  done: boolean;
}

export type Step = { kind: "thinking" | "writing"; at: number } | ({ kind: "tool" } & Omit<ToolCall, "done">);

export interface Activity {
  step: Step | null;
  /** This turn's tool calls, oldest first. */
  turn: ToolCall[];
}

const KINDS: Record<string, ToolKind> = {
  Read: "read",
  NotebookRead: "read",
  Grep: "search",
  Glob: "search",
  LS: "search",
  LSP: "search",
  ToolSearch: "search",
  Edit: "edit",
  MultiEdit: "edit",
  Write: "edit",
  NotebookEdit: "edit",
  Bash: "run",
  PowerShell: "run",
  BashOutput: "run",
  Monitor: "run",
  WebFetch: "web",
  WebSearch: "web",
  Task: "agent",
  Agent: "agent",
};

export function toolKind(tool: string): ToolKind {
  return KINDS[tool] ?? "other";
}

/** "mcp__github__create_issue" as "create_issue"; other names as they are. */
export function toolLabel(tool: string): string {
  return tool.startsWith("mcp__") ? tool.slice(tool.lastIndexOf("__") + 2) : tool;
}

export function doingOf(step: Step | null): Doing | null {
  if (!step) return null;
  if (step.kind === "tool") return toolKind(step.tool);
  return step.kind === "thinking" ? "think" : "write";
}

function stepOf(v: unknown): Step | null {
  const s = fieldsOf(v);
  if (s.kind === "thinking" || s.kind === "writing") return { kind: s.kind, at: numberOf(s.at) ?? 0 };
  const tool = textOf(s.tool);
  return s.kind === "tool" && tool ? { kind: "tool", tool, target: textOf(s.target), at: numberOf(s.at) ?? 0 } : null;
}

/** The backend's activity, checked; entries that make no sense are dropped. */
export function activityOf(data: unknown): Activity {
  const d = fieldsOf(data);
  const turn = (Array.isArray(d.turn) ? d.turn : []).flatMap((item): ToolCall[] => {
    const c = fieldsOf(item);
    const tool = textOf(c.tool);
    return tool ? [{ tool, target: textOf(c.target), at: numberOf(c.at) ?? 0, done: c.done === true }] : [];
  });
  return { step: stepOf(d.step), turn };
}

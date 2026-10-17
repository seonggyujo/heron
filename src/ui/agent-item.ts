import { markOf, type Agent } from "../agent/agent-model";
import { modelLabel } from "../agent/model-label";
import { span } from "../app/dom";
import { formatUptime } from "../app/durations";
import { t } from "../i18n/lang";
import type { Changes } from "../ipc/folders";
import { createDoing, createTurnStrip, turnTips } from "./agent-activity";
import { createTokenLine, tokenTips } from "./agent-tokens";
import { createSubagentLines } from "./subagent-lines";

// One row of the agent sidebar:
//   [1] heron   Opus 5.5   2m 14s
//       needs permission · Bash: cargo test     +12 −3
//       ▪▪▪▪▪▫
//       1.24M tokens · 38.2k this turn
//       ⚠ Sonnet 5
//       ↳ Explore              1m 02s
// The pane number's badge takes the state's color. While it works, the
// state line says what it does ("● editing main.ts"), and the blocks are
// this turn's tools (agent-activity.ts), the tokens line what the session
// and the turn used (agent-tokens.ts). The model is the session's, the
// counts are the folder's uncommitted lines, the last lines its running
// subagents (subagent-lines.ts). Collapsed, only the badge
// shows; the tooltip says the rest.

export interface AgentRow {
  pty: number;
  /** 1-based position among the panes. */
  number: number;
  folder: string;
  /** The agent's folder, else the shell's; null = not known yet. */
  path: string | null;
  agent: Agent;
  /** Uncommitted changes in the folder's repository; null outside one or until git answered. */
  changes: Changes | null;
}

export interface AgentItem {
  el: HTMLButtonElement;
  /** Updates the working time. */
  tick(now: number): void;
}

function stateText(a: Agent): string {
  const s = t();
  return {
    idle: s.agentIdle,
    working: s.agentWorking,
    permission: s.agentPermission,
    question: s.agentQuestion,
    waiting: s.agentWaiting,
    done: s.agentDone,
  }[a.state];
}

/** The state, and what the agent asks for when it waits on a permission or a question. */
function lineText(a: Agent): string {
  const asks = a.state === "permission" || a.state === "question";
  return asks && a.message ? `${stateText(a)} · ${a.message}` : stateText(a);
}

export function createAgentItem(row: AgentRow, onPick: (pty: number) => void, onHover: (pty: number | null) => void): AgentItem {
  const { agent: a } = row;
  const el = document.createElement("button");
  el.type = "button";
  el.className = `agent-item ${markOf(a.state)}`;

  const time = span("agent-time");
  const top = span("agent-top");
  top.append(span("agent-name", row.folder));
  // The model the session runs with; it follows /model within a poll.
  const model = a.check?.selected ?? a.check?.actual ?? null;
  if (model) top.append(span("agent-model", modelLabel(model)));
  top.append(time);
  const line = span("agent-line");
  // While it works, what it does now (agent-activity.ts).
  const step = a.state === "working" ? a.activity?.step : null;
  line.append(step ? createDoing(step) : span("agent-state", lineText(a)));
  const body = span("agent-body");
  body.append(top, line);
  const strip = a.state !== "idle" && a.activity ? createTurnStrip(a.activity) : null;
  if (strip) body.append(strip);
  const tips = [`${row.number} · ${row.folder} · ${stateText(a)}`, row.path, a.title, a.message];
  if (strip && a.activity) tips.push(...turnTips(a.activity));
  const tokens = a.tokens && createTokenLine(a.tokens);
  if (tokens && a.tokens) {
    body.append(tokens);
    tips.push(...tokenTips(a.tokens));
  }
  if (row.changes && row.changes.files > 0) {
    const diff = span("agent-diff");
    diff.append(span("agent-added", `+${row.changes.added}`), span("agent-removed", `−${row.changes.removed}`));
    line.append(diff);
    tips.push(t().uncommitted(row.changes.files));
  }
  if (a.check?.state === "mismatch") {
    body.append(span("agent-warn", `⚠ ${modelLabel(a.check.actual ?? "?")}`));
    tips.push(t().agentMismatch(a.check.selected ?? "?", a.check.actual ?? "?"));
  }
  const subs = createSubagentLines(a.subagents);
  if (subs.el) body.append(subs.el);
  el.append(span("agent-n", String(row.number)), body);
  el.title = tips.filter(Boolean).join("\n");

  el.addEventListener("click", () => onPick(row.pty));
  el.addEventListener("mouseenter", () => onHover(row.pty));
  el.addEventListener("mouseleave", () => onHover(null));

  return {
    el,
    tick(now) {
      time.textContent = a.state === "working" ? formatUptime(now - a.since) : "";
      subs.tick(now);
    },
  };
}

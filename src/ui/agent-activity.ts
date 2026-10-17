import { doingOf, toolKind, toolLabel, type Activity, type Step } from "../agent/activity";
import { span } from "../app/dom";
import { t } from "../i18n/lang";

// What the agent of a sidebar row is doing (agent/activity.ts):
//   ● editing main.ts         the state line while it works, the dot in the
//                             color of what it does
//   ▪▪▪▪▪▪▫                   this turn's tools, one block each, colored by
//                             kind; a tool still running is outlined
// The row's tooltip lists the last tools.

const BLOCKS_MAX = 24;
const TIPS_MAX = 8;

/** The words for a step: "thinking", "editing main.ts". */
function doingText(step: Step): string {
  const s = t();
  if (step.kind !== "tool") return step.kind === "thinking" ? s.doingThink : s.doingWrite;
  const what = step.target ?? toolLabel(step.tool);
  const words = { read: s.doingRead, search: s.doingSearch, edit: s.doingEdit, run: s.doingRun, web: s.doingWeb, agent: s.doingAgent, other: s.doingTool };
  return words[toolKind(step.tool)](what);
}

/** The state line's text while the agent works on a step, with the dot of its kind. */
export function createDoing(step: Step): HTMLSpanElement {
  return span(`agent-state agent-doing k-${doingOf(step)}`, doingText(step));
}

/** This turn's tools as blocks; null before the first one. */
export function createTurnStrip(activity: Activity): HTMLSpanElement | null {
  if (!activity.turn.length) return null;
  const el = span("agent-turn");
  for (const call of activity.turn.slice(-BLOCKS_MAX)) {
    el.append(span(`agent-turn-tool k-${toolKind(call.tool)}${call.done ? "" : " live"}`));
  }
  return el;
}

/** Tooltip lines: how many tools this turn, and the last of them. */
export function turnTips(activity: Activity): string[] {
  if (!activity.turn.length) return [];
  const last = activity.turn.slice(-TIPS_MAX).map((c) => `  ${toolLabel(c.tool)}${c.target ? ` ${c.target}` : ""}`);
  return [t().turnTools(activity.turn.length), ...last];
}

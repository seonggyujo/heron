import type { Subagent } from "../agent/subagents";
import { span } from "../app/dom";
import { formatUptime } from "../app/durations";
import { t } from "../i18n/lang";

// The subagents under an agent's row in the sidebar, oldest first:
//   ↳ Explore            1m 02s
//   ↳ general-purpose       12s
// At most three lines, then "+2 more". Each shows how long it has run.

const MAX_LINES = 3;

export interface SubagentLines {
  /** Null when no subagent runs. */
  el: HTMLElement | null;
  tick(now: number): void;
}

export function createSubagentLines(subagents: readonly Subagent[]): SubagentLines {
  if (subagents.length === 0) return { el: null, tick: () => {} };
  const el = span("agent-subs");
  const times = subagents.slice(0, MAX_LINES).map((sub) => {
    const time = span("agent-sub-time");
    const line = span("agent-sub");
    line.append(span("agent-sub-type", `↳ ${sub.type}`), time);
    el.append(line);
    return { time, since: sub.since };
  });
  if (subagents.length > MAX_LINES) el.append(span("agent-sub agent-sub-more", t().moreSubagents(subagents.length - MAX_LINES)));
  return {
    el,
    tick(now) {
      times.forEach(({ time, since }) => (time.textContent = formatUptime(Math.max(0, now - since))));
    },
  };
}

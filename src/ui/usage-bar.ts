import { fillOf, type Limits } from "../agent/usage";
import type { UptimeClock } from "../app/uptime-clock";
import { onLangChange, t } from "../i18n/lang";
import type { AgentRow } from "./agent-item";
import { createLimitMeter } from "./limit-meter";

// The bar along the bottom of the window, from the heron-limits plugin:
//   5-hour limit  resets in 2h 13m | Weekly limit  resets in 4d 2h | Context
//   58% ━━━━━━────                 | 21% ━━────────              | [1 heron 34%] [2 api 71%]
// Each context chip is one agent, in pane order; clicking it goes to that
// pane. Hidden while there is neither a limit nor a context figure.

export interface UsageBar {
  el: HTMLElement;
  render(rows: AgentRow[], limits: Limits | null): void;
}

export function createUsageBar(clock: UptimeClock, onPick: (pty: number) => void): UsageBar {
  const el = document.createElement("footer");
  el.className = "usage-bar";
  el.hidden = true;
  const fiveHour = createLimitMeter(() => t().limitFiveHour);
  const sevenDay = createLimitMeter(() => t().limitWeekly);
  const context = document.createElement("div");
  context.className = "usage-context";
  context.innerHTML = '<span class="usage-label"></span><div class="usage-chips"></div>';
  const label = context.querySelector<HTMLElement>(".usage-label")!;
  const chips = context.querySelector<HTMLElement>(".usage-chips")!;
  el.append(fiveHour.el, sevenDay.el, context);

  let rows: AgentRow[] = [];
  let limits: Limits | null = null;

  // Every second while limits show: the time until each one resets.
  const tick = (now: number) => {
    fiveHour.show(limits?.fiveHour ?? null, now / 1000);
    sevenDay.show(limits?.sevenDay ?? null, now / 1000);
  };
  const ticking = clock.switchFor(tick);

  const draw = () => {
    const withContext = rows.filter((r) => r.agent.context !== null).sort((a, b) => a.number - b.number);
    label.textContent = t().context;
    chips.replaceChildren(...withContext.map((row) => createChip(row, onPick)));
    context.hidden = withContext.length === 0;
    el.hidden = limits === null && withContext.length === 0;
    tick(Date.now());
    ticking(limits !== null);
  };
  onLangChange(draw);

  return {
    el,
    render(nextRows, nextLimits) {
      rows = nextRows;
      limits = nextLimits;
      draw();
    },
  };
}

function createChip(row: AgentRow, onPick: (pty: number) => void): HTMLButtonElement {
  const percent = Math.round(row.agent.context ?? 0);
  const el = document.createElement("button");
  el.type = "button";
  el.className = `usage-chip ${fillOf(percent)}`;
  el.innerHTML = '<span class="chip-name"></span><span class="chip-used"></span>';
  el.querySelector(".chip-name")!.textContent = `${row.number} ${row.folder}`;
  el.querySelector(".chip-used")!.textContent = `${percent}%`;
  el.title = t().contextUsed(row.folder, percent);
  el.addEventListener("click", () => onPick(row.pty));
  return el;
}

import type { Limits } from "../agent/usage";
import type { UptimeClock } from "../app/uptime-clock";
import { onLangChange, t } from "../i18n/lang";
import type { AgentRow } from "./agent-item";
import { createLimitMeter } from "./limit-meter";
import { createUsageCard } from "./usage-card";

// The bar along the bottom of the window:
//   5-hour limit 58% ━━━━── resets in 2h 13m │ [1 heron  ⎇ main        ] [2 api  ⎇ feat/login    ]
//   Weekly limit 21% ━───── resets in 4d 2h  │ [Opus 5.5 · high  34% ━━] [Sonnet 5.5 · max 71% ━━]
// The limits come from the heron-limits plugin; each card is one agent, in
// pane order (usage-card.ts), and clicking it goes to that pane. Hidden
// while there is neither a limit nor an agent.

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
  const limitsBox = document.createElement("div");
  limitsBox.className = "usage-limits";
  limitsBox.append(fiveHour.el, sevenDay.el);
  const cards = document.createElement("div");
  cards.className = "usage-cards";
  el.append(limitsBox, cards);

  let rows: AgentRow[] = [];
  let limits: Limits | null = null;

  // Every second while limits show: the time until each one resets.
  const tick = (now: number) => {
    fiveHour.show(limits?.fiveHour ?? null, now / 1000);
    sevenDay.show(limits?.sevenDay ?? null, now / 1000);
  };
  const ticking = clock.switchFor(tick);

  const draw = () => {
    const inOrder = [...rows].sort((a, b) => a.number - b.number);
    cards.replaceChildren(...inOrder.map((row) => createUsageCard(row, onPick)));
    cards.hidden = inOrder.length === 0;
    limitsBox.hidden = limits === null;
    el.hidden = limits === null && inOrder.length === 0;
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

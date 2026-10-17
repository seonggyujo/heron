import { fillOf, type Limit } from "../agent/usage";
import { formatResetIn } from "../app/durations";
import { t } from "../i18n/lang";

// One usage limit in the usage bar:
//   5-hour limit   resets in 2h 13m
//   58%  ━━━━━━━━────────
// The number and the bar turn yellow from 70% and red from 90%. Hidden
// while the limit is unknown.

export interface LimitMeter {
  el: HTMLElement;
  show(limit: Limit | null, nowSec: number): void;
}

/** `label` is read on every show, so it follows the language. */
export function createLimitMeter(label: () => string): LimitMeter {
  const el = document.createElement("div");
  el.className = "limit-meter";
  el.innerHTML =
    '<div class="limit-head"><span class="limit-label"></span><span class="limit-reset"></span></div>' +
    '<div class="limit-main"><span class="limit-used"></span><span class="limit-track"><span class="limit-fill"></span></span></div>';
  const name = el.querySelector<HTMLElement>(".limit-label")!;
  const reset = el.querySelector<HTMLElement>(".limit-reset")!;
  const used = el.querySelector<HTMLElement>(".limit-used")!;
  const fill = el.querySelector<HTMLElement>(".limit-fill")!;

  return {
    el,
    show(limit, nowSec) {
      el.hidden = !limit;
      if (!limit) return;
      const pct = Math.min(100, Math.max(0, limit.used));
      const look = fillOf(pct);
      el.classList.toggle("warn", look === "warn");
      el.classList.toggle("bad", look === "bad");
      name.textContent = label();
      used.textContent = `${Math.round(pct)}%`;
      fill.style.width = `${pct}%`;
      reset.textContent = limit.resetsAt ? t().limitResets(formatResetIn(limit.resetsAt - nowSec)) : "";
    },
  };
}

import { modelLabel } from "../agent/model-label";
import { fillOf } from "../agent/usage";
import { span } from "../app/dom";
import { t } from "../i18n/lang";
import type { AgentRow } from "./agent-item";

// One agent's card in the usage bar, in pane order:
//   1 heron  ⎇ main
//   Opus 5.5 · high     34% ━━──
// The model is the session's (it follows /model), the effort and the
// context use come from the heron-limits plugin, the branch from git. What
// is not known yet is left out. The context turns yellow from 70% and red
// from 90%. Clicking the card goes to its pane.

export function createUsageCard(row: AgentRow, onPick: (pty: number) => void): HTMLButtonElement {
  const a = row.agent;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "usage-card";

  const top = span("card-top");
  top.append(span("card-n", String(row.number)), span("card-name", row.folder));
  if (row.branch) top.append(span("card-branch", `⎇ ${row.branch}`));

  const bottom = span("card-bottom");
  const modelId = a.check?.selected ?? a.check?.actual ?? null;
  const model = modelId && modelLabel(modelId);
  if (model) bottom.append(span("card-model", model));
  if (a.effort) bottom.append(span("card-effort", a.effort));
  const tips = [`${row.number} · ${row.folder}`, row.path, row.branch && `⎇ ${row.branch}`, model, a.effort && t().effortLevel(a.effort)];
  if (a.context !== null) {
    const percent = Math.round(a.context);
    bottom.append(createContextMeter(percent));
    tips.push(t().contextUsed(row.folder, percent));
  }

  el.append(top, bottom);
  el.title = tips.filter(Boolean).join("\n");
  el.addEventListener("click", () => onPick(row.pty));
  return el;
}

/** "34% ━━──", in the color of how full it is. */
function createContextMeter(percent: number): HTMLElement {
  const meter = span(`card-context ${fillOf(percent)}`);
  const track = span("card-track");
  const fill = span("card-fill");
  fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  track.append(fill);
  meter.append(span("card-used", `${percent}%`), track);
  return meter;
}

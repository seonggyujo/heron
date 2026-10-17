// The heron-limits plugin's status file for one pane: the account's usage
// limits (5-hour and weekly) and how much of its context window the
// agent uses. Pure: the file comes in unchecked (ipc/agent.ts).

import { fieldsOf, numberOf } from "../app/unchecked";

export interface Limit {
  used: number;
  /** Epoch seconds. */
  resetsAt: number | null;
}

export interface Limits {
  fiveHour: Limit | null;
  sevenDay: Limit | null;
  /** When the plugin wrote them (ms), to keep the newest. */
  at: number;
}

/**
 * The limits in a status file, or null when it has none: a new session's
 * status line has no limits before its first answer, and the last known
 * ones must stay on screen meanwhile.
 */
export function limitsOf(data: unknown): Limits | null {
  const d = fieldsOf(data);
  const at = numberOf(d.at);
  if (at === null) return null;
  const limit = (v: unknown): Limit | null => {
    const used = numberOf(fieldsOf(v).used);
    return used === null ? null : { used, resetsAt: numberOf(fieldsOf(v).resets_at) };
  };
  const l = fieldsOf(d.limits);
  const fiveHour = limit(l.five_hour);
  const sevenDay = limit(l.seven_day);
  return fiveHour || sevenDay ? { fiveHour, sevenDay, at } : null;
}

/** Percent of the context window in use, or null before the first answer. */
export function contextOf(data: unknown): number | null {
  return numberOf(fieldsOf(data).context);
}

/** The same on screen: the same use and reset of each limit, whenever written. */
export function sameLimits(a: Limits | null, b: Limits | null): boolean {
  const same = (x: Limit | null, y: Limit | null) => x === y || (!!x && !!y && x.used === y.used && x.resetsAt === y.resetsAt);
  return a === b || (!!a && !!b && same(a.fiveHour, b.fiveHour) && same(a.sevenDay, b.sevenDay));
}

/** How full a meter looks: green, yellow from 70%, red from 90%. */
export type Fill = "ok" | "warn" | "bad";

export function fillOf(percent: number): Fill {
  if (percent >= 90) return "bad";
  return percent >= 70 ? "warn" : "ok";
}

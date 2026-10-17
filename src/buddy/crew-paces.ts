import type { Doing } from "../agent/activity";

// How a busy heron goes about, following what the agent does: reading and
// searching peck, editing walks (with a twig, crew-pose.ts), running a
// command runs, the web flies about, thinking stands still. Pure.

export interface Pace {
  /** Sprite pixels a second; 0 stands still. */
  speed: number;
  /** Out of 10 stops, how many are pecks (the rest are pauses). */
  pecks: number;
  /** How long between flights to other room (ms, shortest and longest). */
  wander: [number, number];
}

const PACE: Pace = { speed: 14, pecks: 6, wander: [9000, 16000] };
const PACES: Partial<Record<Doing, Pace>> = {
  think: { speed: 0, pecks: 0, wander: [9000, 16000] },
  read: { speed: 11, pecks: 9, wander: [9000, 16000] },
  search: { speed: 11, pecks: 9, wander: [6000, 10000] },
  edit: { speed: 14, pecks: 1, wander: [9000, 16000] },
  run: { speed: 34, pecks: 0, wander: [9000, 16000] },
  web: { speed: 14, pecks: 3, wander: [2500, 4500] },
};

/** The pace for what the agent does; the plain one when unknown, or while it writes or uses another tool. */
export const paceOf = (doing: Doing | null): Pace => (doing && PACES[doing]) || PACE;

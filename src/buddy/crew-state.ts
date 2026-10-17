import type { Doing } from "../agent/activity";
import type { AgentState } from "../agent/agent-model";
import type { Screen, Spot } from "./ground";
import { HERON_W } from "./sprites";

// One heron of a pane and its chicks (crew.ts moves it), and what the
// crew modules share. Positions are in sprite pixels from the terminal's
// top-left corner; a y is where feet stand. Times are ms on a clock that
// only goes forward. Pure.

export const CHICKS_MAX = 6;
export const PUFFS_MAX = 8;
/** The frame time while something moves. */
export const FRAME_MS = 33;
/** How long a finished turn is cheered. */
export const CHEER_MS = 2400;
/** The call mark bobs at this beat. */
export const CALL_MS = 400;
export const PUFF_MS = 450;

export type Mood = "gone" | "asleep" | "busy" | "calling" | "asking" | "cheering";
export type Act = "walk" | "peck" | "pause";

export interface Point {
  x: number;
  y: number;
}

export interface CrewInput {
  screen: Screen;
  /** The pane has an agent. */
  present: boolean;
  state: AgentState;
  /** What the agent does now, when its transcript is followed. */
  doing: Doing | null;
  subagents: number;
  /** One cell, in sprite pixels. */
  cellW: number;
  cellH: number;
}

export interface Chick {
  /** Left edge and feet. */
  at: Point;
  moving: boolean;
  born: number;
}

/** A spark that rises and fades: a cheer, or a chick leaving. */
export interface Puff {
  /** Top-left at the start. */
  at: Point;
  start: number;
}

export interface Crew {
  rng: number;
  /** Its place among the pane's herons, from 0. */
  index: number;
  mood: Mood;
  /** When the mood began. */
  moodAt: number;
  last: number;
  doing: Doing | null;
  cellW: number;
  cellH: number;
  /** Has a spot: stands there or flies to it. */
  placed: boolean;
  spot: Spot;
  /** The heron's left edge and feet; while flying, where it lands. */
  at: Point;
  /** 1 faces right, -1 left. */
  dir: 1 | -1;
  flying: boolean;
  from: Point;
  flyAt: number;
  flyMs: number;
  act: Act;
  actAt: number;
  actUntil: number;
  wanderAt: number;
  retryAt: number;
  /** Distance walked, for the stride. */
  walked: number;
  /** Fades in and out. */
  opacity: number;
  chicks: Chick[];
  puffs: Puff[];
}

/** A random whole number in [lo, hi) (xorshift32). */
export function random(c: Crew, lo: number, hi: number): number {
  let x = c.rng;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  c.rng = x;
  return hi > lo ? lo + (x % (hi - lo)) : lo;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function cheering(c: Crew, now: number): boolean {
  return c.mood === "cheering" && now - c.moodAt < CHEER_MS;
}

export function puff(c: Crew, at: Point, start: number): void {
  if (c.puffs.length < PUFFS_MAX) c.puffs.push({ at, start });
}

/** Where the heron is at now: on its spot, or along its flight's arc. */
export function heronAt(c: Crew, now: number): Point {
  if (!c.flying || !c.flyMs) return c.at;
  const t = clamp((now - c.flyAt) / c.flyMs, 0, 1);
  const e = t * t * (3 - 2 * t);
  const dx = c.at.x - c.from.x;
  const dy = c.at.y - c.from.y;
  const arc = Math.min(Math.hypot(dx, dy) * 0.3, 18) + 4;
  return { x: c.from.x + dx * e, y: c.from.y + dy * e - arc * 4 * t * (1 - t) };
}

/** The middle of the heron, for facing and for marks. */
export const heronMiddle = (at: Point): number => at.x + HERON_W / 2;

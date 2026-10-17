import { groundFind, groundRun, type FindMode, type Spot } from "./ground";
import { paceOf, type Pace } from "./crew-paces";
import { clamp, heronAt, heronMiddle, random, type Crew, type CrewInput, type Point } from "./crew-state";
import { HERON_W, STAGE_H } from "./sprites";

// How the heron gets around: keeping to blank cells, flying to new room,
// and, while the agent works, walking and pecking at the pace of what the
// agent does (crew-paces.ts). Pure.

/** With no room, how often to look again. */
const RETRY_MS = 250;
/**
 * Cells kept between the heron and the ends of its run when there is room:
 * text beside a run tends to grow (longer lines scroll in) and cover it.
 */
const EDGE_ROOM = 2;
/** Runs this many cells wider than the heron are tried first. */
const ROOMY = 2 * EDGE_ROOM + 1;
/** Between herons that fly in together. */
const LINE_GAP = HERON_W + 6;

const rowsTall = (in_: CrewInput) => Math.ceil(STAGE_H / in_.cellH - 0.01);
const colsWide = (in_: CrewInput) => Math.ceil(HERON_W / in_.cellW - 0.01);

/** How far the heron keeps from each end of its run. */
function edgeRoom(c: Crew): number {
  const slack = (c.spot.c1 - c.spot.c0) * c.cellW - HERON_W;
  return slack > 0 ? Math.min(EDGE_ROOM * c.cellW, slack / 2) : 0;
}

/** The heron's left edge at the two ends of its run, a little way in from the text beside it. */
const leftEnd = (c: Crew) => c.spot.c0 * c.cellW + edgeRoom(c);
const rightEnd = (c: Crew) => Math.max(leftEnd(c), c.spot.c1 * c.cellW - HERON_W - edgeRoom(c));

/** A roomy run first, else any run the heron fits in. */
function findRoom(in_: CrewInput, extra: number, mode: FindMode, col: number, row: number, pick: number): Spot | null {
  const w = colsWide(in_) + extra;
  const h = rowsTall(in_);
  return groundFind(in_.screen, w + ROOMY, h, mode, col, row, pick) ?? groundFind(in_.screen, w, h, mode, col, row, pick);
}

/** The run under a heron standing at `at`. */
function runUnder(in_: CrewInput, at: Point): Spot | null {
  const row = Math.round(at.y / in_.cellH) - 1;
  const col0 = Math.floor(at.x / in_.cellW + 0.01);
  const col1 = Math.floor((at.x + HERON_W) / in_.cellW - 0.01);
  return groundRun(in_.screen, row, rowsTall(in_), col0, col1);
}

/**
 * Flies to s from where the heron is, or in from the nearer side when it
 * was not to be seen, landing a heron's width further in for each heron of
 * the pane before it.
 */
function flyTo(c: Crew, in_: CrewInput, s: Spot, now: number): void {
  let from = heronAt(c, now);
  c.spot = s;
  c.placed = true;
  const to = { x: clamp(from.x, leftEnd(c), rightEnd(c)), y: (s.row + 1) * in_.cellH };
  if (c.opacity <= 0.01) {
    const width = in_.screen.cols * in_.cellW;
    const right = heronMiddle(to) > width / 2;
    from = { x: right ? width + 2 : -HERON_W - 2, y: to.y - 2 * in_.cellH };
    const inBy = c.index * LINE_GAP;
    to.x = clamp(right ? rightEnd(c) - inBy : leftEnd(c) + inBy, leftEnd(c), rightEnd(c));
    c.opacity = 1;
  }
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (Math.abs(to.x - from.x) > 0.5) c.dir = to.x > from.x ? 1 : -1;
  c.from = from;
  c.at = to;
  c.flying = dist >= 1;
  c.flyAt = now;
  c.flyMs = clamp(dist * 9, 350, 1100);
}

/** Refreshes the heron's run, or flies it to the nearest room, or lets it go when there is none. */
export function keepSpot(c: Crew, in_: CrewInput, now: number): void {
  if (c.flying) return; // looked at again once it lands
  const under = c.placed ? runUnder(in_, c.at) : null;
  if (under) {
    c.spot = under;
    return;
  }
  if (now < c.retryAt) return;
  const col = Math.trunc(c.at.x / in_.cellW);
  const row = Math.round(c.at.y / in_.cellH) - 1;
  const room = findRoom(in_, 1, c.opacity > 0.01 ? "near" : "home", col, row, 0);
  if (room) {
    flyTo(c, in_, room, now);
    return;
  }
  c.placed = false;
  c.retryAt = now + RETRY_MS;
}

/** Now and then the busy heron flies to another run with room to walk. */
function wander(c: Crew, in_: CrewInput, pace: Pace, now: number): void {
  c.wanderAt = now + random(c, ...pace.wander);
  const room = findRoom(in_, 3, "any", 0, 0, random(c, 0, 2 ** 30));
  if (!room || (room.row === c.spot.row && room.c0 === c.spot.c0)) return; // none, or its own run
  flyTo(c, in_, room, now);
}

/** Walking, then pecking or a pause, then walking again, maybe turned round. */
function nextAct(c: Crew, pace: Pace, now: number): void {
  const shortest = { walk: 1500, peck: 700, pause: 400 };
  const longest = { walk: 4000, peck: 1300, pause: 900 };
  if (c.act === "walk" || pace.speed === 0) {
    c.act = random(c, 0, 10) < pace.pecks ? "peck" : "pause";
  } else {
    c.act = "walk";
    if (random(c, 0, 10) < 3) c.dir = c.dir > 0 ? -1 : 1;
  }
  c.actAt = now;
  c.actUntil = now + random(c, shortest[c.act], longest[c.act]);
}

/** Walking, pecking and wandering while the agent works. */
export function busy(c: Crew, in_: CrewInput, dt: number, now: number): void {
  const pace = paceOf(c.doing);
  // A new pace that wanders sooner does not wait out the old one's flight.
  c.wanderAt = Math.min(c.wanderAt, now + pace.wander[1]);
  if (pace.speed > 0 && now >= c.wanderAt) {
    wander(c, in_, pace, now);
    if (c.flying) return;
  }
  if (now >= c.actUntil || (c.act === "walk" && pace.speed === 0)) nextAct(c, pace, now);
  if (c.act !== "walk") return;
  // It turns at the ends of its run. When the ends moved past it (text grew
  // without covering it), it turns where it is instead of jumping.
  const left = leftEnd(c);
  const right = rightEnd(c);
  let next = c.at.x + c.dir * pace.speed * dt;
  if (c.dir > 0 && next > right) {
    next = Math.max(c.at.x, right);
    c.dir = -1;
  } else if (c.dir < 0 && next < left) {
    next = Math.min(c.at.x, left);
    c.dir = 1;
  }
  c.walked += Math.abs(next - c.at.x);
  c.at.x = next;
}

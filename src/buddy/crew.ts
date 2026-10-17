import { chicksUpdate } from "./crew-chicks";
import { busy, keepSpot } from "./crew-moves";
import { heronAt, heronMiddle, puff, PUFF_MS, random, type Crew, type CrewInput, type Mood } from "./crew-state";
import { HERON_H, HERON_W } from "./sprites";

// A terminal heron acting out its pane's agent (crew-state.ts has its
// shape). It stands on blank cells of the terminal (ground.ts):
//   working     walks its run, stops to peck, now and then flies elsewhere,
//               at a pace that follows what the agent does (crew-moves.ts)
//   permission  calls with a !, flapping now and then (question, waiting: ?)
//   done        cheers with its wings up and a few sparks, then stands
//   idle        sleeps on one leg
// It flies in from the side when it first finds room, flies to the nearest
// room when text covers its spot, and fades out when there is none or the
// agent leaves. Each running subagent is a chick that follows one of the
// pane's herons (crew-chicks.ts). Pure: the caller gives the screen, the
// agent and the time, and draws the poses (crew-pose.ts).

const FADE_MS = 300;
/** Seconds: after a long still spell, move as if one frame passed. */
const MAX_STEP = 0.1;
/** Between the herons of one pane flying in. */
const ARRIVE_GAP_MS = 500;

/** The heron at index flies in index * 0.5 s after the first and lands a little further in, so a pane's herons arrive one by one, side by side. */
export function newCrew(seed: number, index: number, now: number): Crew {
  const origin = { x: 0, y: 0 };
  return {
    rng: seed >>> 0 || 1,
    index,
    mood: "gone",
    moodAt: now,
    last: now,
    doing: null,
    cellW: 1,
    cellH: 1,
    placed: false,
    spot: { row: 0, c0: 0, c1: 0 },
    at: { ...origin },
    dir: -1,
    flying: false,
    from: { ...origin },
    flyAt: 0,
    flyMs: 0,
    act: "pause",
    actAt: now,
    actUntil: now,
    wanderAt: now,
    retryAt: now + index * ARRIVE_GAP_MS, // looks for room only then
    walked: 0,
    opacity: 0,
    chicks: [],
    puffs: [],
  };
}

function moodOf(in_: CrewInput): Mood {
  if (!in_.present) return "gone";
  switch (in_.state) {
    case "working":
      return "busy";
    case "permission":
      return "calling";
    case "question":
    case "waiting":
      return "asking";
    case "done":
      return "cheering";
    default:
      return "asleep";
  }
}

/** Three sparks around the heron's head, one after another. */
function sparks(c: Crew, now: number): void {
  const at = heronAt(c, now);
  const top = at.y - HERON_H;
  puff(c, { x: at.x - 3, y: top + 2 }, now);
  puff(c, { x: at.x + HERON_W / 2 - 1, y: top - 5 }, now + 150);
  puff(c, { x: at.x + HERON_W, y: top }, now + 300);
}

function setMood(c: Crew, mood: Mood, in_: CrewInput, now: number): void {
  if (mood === c.mood) return;
  c.mood = mood;
  c.moodAt = now;
  if (mood === "busy") {
    c.act = "pause";
    c.actUntil = now;
    c.wanderAt = now + random(c, 6000, 12000);
  } else if (mood === "cheering" && c.opacity > 0.01) {
    sparks(c, now);
  } else if (mood === "calling" || mood === "asking") {
    const middle = (in_.screen.cols * in_.cellW) / 2; // it calls toward the middle
    c.dir = heronMiddle(c.at) > middle ? -1 : 1;
  }
}

/** Moves the crew to now. */
export function crewUpdate(c: Crew, in_: CrewInput, now: number): void {
  const dt = now > c.last ? Math.min((now - c.last) / 1000, MAX_STEP) : 0;
  c.last = now;
  c.cellW = in_.cellW;
  c.cellH = in_.cellH;
  c.doing = in_.doing;
  setMood(c, moodOf(in_), in_, now);
  if (c.flying && now >= c.flyAt + c.flyMs) c.flying = false; // landed
  // Mid-frame (synchronized output) the screen may be half redrawn: the
  // spot is judged on the finished frame.
  if (c.mood !== "gone" && !in_.screen.synchronized) keepSpot(c, in_, now);
  const shown = c.placed && c.mood !== "gone";
  const fade = (dt * 1000) / FADE_MS;
  c.opacity = shown ? Math.min(1, c.opacity + fade) : Math.max(0, c.opacity - fade);
  if (shown && !c.flying && c.mood === "busy") busy(c, in_, dt, now);
  chicksUpdate(c, shown ? in_.subagents : 0, dt, now);
  c.puffs = c.puffs.filter((p) => now < p.start + PUFF_MS);
}

/** The agent left and everything has faded: the crew can go. */
export function crewDone(c: Crew): boolean {
  return c.mood === "gone" && c.opacity <= 0 && !c.chicks.length && !c.puffs.length;
}

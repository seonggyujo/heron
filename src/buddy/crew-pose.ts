import { CALL_MS, cheering, FRAME_MS, heronAt, PUFF_MS, type Crew, type Point } from "./crew-state";
import { CHICK_H, HERON_H, HERON_W, spriteOf, type SpriteId } from "./sprites";

// What the crew looks like at a moment, and when that next changes. Over
// the poses of crew.ts come what the agent does: a twig in the beak while
// it edits, three dots while it thinks. Pure.

const WING_MS = 120; // a flight's wing beat
const CHEER_BEAT = 150;
const PECK_MS = 220;
const STRIDE = 4; // sprite pixels walked per step
const HATCH_MS = 200; // a new chick fades in
const THINK_MS = 350; // the thought dots come one by one

export interface PoseItem {
  sprite: SpriteId;
  /** Top-left, in sprite pixels. */
  x: number;
  y: number;
  /** Mirrored: faces left. */
  flip: boolean;
  opacity: number;
}

const beat = (ms: number, length: number) => Math.floor(ms / length);

function heronSprite(c: Crew, now: number): SpriteId {
  if (c.flying) return beat(now, WING_MS) % 2 ? "flyUp" : "flyDown";
  switch (c.mood) {
    case "asleep":
      return "sleep";
    case "cheering":
      return cheering(c, now) && beat(now, CHEER_BEAT) % 2 ? "cheer" : "stand";
    case "calling":
    case "asking": // a flap every fourth beat
      return beat(now - c.moodAt, CALL_MS) % 4 === 3 ? "cheer" : "stand";
    case "busy":
      if (c.act === "walk") return Math.floor(c.walked / STRIDE) % 2 ? "walkA" : "walkB";
      if (c.act === "peck") return beat(now - c.actAt, PECK_MS) % 2 ? "stand" : "peck";
      return "stand";
    default:
      return "stand";
  }
}

/** How high a cheering heron hops at now. */
function hop(c: Crew, now: number): number {
  if (c.flying || !cheering(c, now)) return 0;
  return Math.abs(Math.sin((now - c.moodAt) * 0.0045)) * 5;
}

/**
 * Over its head: ! or ? while it calls (bobbing), z while it sleeps (rising
 * once a second), dots while the agent thinks. In its beak: a twig while
 * the agent edits.
 */
function addMarks(items: PoseItem[], c: Crew, at: Point, sprite: SpriteId, now: number): void {
  if (c.flying) return;
  const left = c.dir < 0;
  const add = (s: SpriteId, x: number, y: number, flip = false) => items.push({ sprite: s, x, y, flip, opacity: c.opacity });
  const top = at.y - HERON_H;
  if (c.mood === "calling" || c.mood === "asking") {
    const id = c.mood === "calling" ? "bang" : "ask";
    const s = spriteOf(id);
    const head = left ? HERON_W - 6.5 : 6.5;
    add(id, at.x + head - s.w / 2, top - s.h - (beat(now - c.moodAt, CALL_MS) % 2), false);
  } else if (c.mood === "asleep") {
    add("snore", at.x + (left ? 0 : HERON_W - 4), at.y - 11 - (beat(now, 1000) % 3) * 2);
  } else if (c.mood === "busy" && c.doing === "think") {
    const dots = beat(now, THINK_MS) % 4; // none, one, two, three
    for (let i = 0; i < dots; i++) add("dot", at.x + (left ? 1 : 5) + i * 3, top - 3);
  } else if (c.mood === "busy" && c.doing === "edit" && sprite !== "peck") {
    // Across the beak tip (columns 8 to 11 of the head row, facing right).
    add("twig", left ? at.x - 2 : at.x + HERON_W - 4, top - 1, left);
  }
}

function addChicks(items: PoseItem[], c: Crew, now: number): void {
  const cheer = cheering(c, now);
  c.chicks.forEach((k, i) => {
    const lift = k.moving || cheer ? Math.abs(Math.sin(now * 0.014 + i)) * 2.5 : 0;
    const sprite: SpriteId = c.mood === "asleep" ? "chickSleep" : lift > 1 ? "chickHop" : "chickStand";
    const hatched = Math.min(1, (now - k.born) / HATCH_MS);
    items.push({ sprite, x: k.at.x, y: k.at.y - CHICK_H - lift, flip: c.dir < 0, opacity: c.opacity * hatched });
  });
}

/** What to draw at now, back to front; faded-out items are left out. */
export function crewPose(c: Crew, now: number): PoseItem[] {
  const items: PoseItem[] = [];
  const at = heronAt(c, now);
  at.y -= hop(c, now);
  const sprite = heronSprite(c, now);
  items.push({ sprite, x: at.x, y: at.y - HERON_H, flip: c.dir < 0, opacity: c.opacity });
  addMarks(items, c, at, sprite, now);
  addChicks(items, c, now);
  for (const p of c.puffs) {
    if (now < p.start) continue;
    const t = (now - p.start) / PUFF_MS;
    items.push({ sprite: "spark", x: p.at.x, y: p.at.y - t * 4, flip: false, opacity: 1 - t });
  }
  return items.filter((it) => it.opacity > 0.01);
}

const chicksBusy = (c: Crew, now: number) => c.chicks.some((k) => k.moving || now - k.born < HATCH_MS);

/** How soon the next frame is needed, 0 for none (all stand still). */
export function crewWait(c: Crew, now: number): number {
  const shown = c.placed && c.mood !== "gone";
  const fading = shown ? c.opacity < 1 : c.opacity > 0;
  if (fading || c.flying || c.puffs.length || chicksBusy(c, now)) return FRAME_MS;
  if (!shown) return 0;
  switch (c.mood) {
    case "busy":
      return c.doing === "think" ? THINK_MS - (now % THINK_MS) : FRAME_MS;
    case "cheering":
      return cheering(c, now) ? FRAME_MS : 0;
    case "calling":
    case "asking":
      return CALL_MS - ((now - c.moodAt) % CALL_MS);
    default:
      return 0; // asleep: the z moves with the 1 s clock
  }
}

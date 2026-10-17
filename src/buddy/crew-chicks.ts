import { CHICKS_MAX, clamp, heronAt, puff, type Crew, type Point } from "./crew-state";
import { CHICK_H, CHICK_W, HERON_W } from "./sprites";

// The chicks, one per running subagent, dealt out among the pane's herons:
// they hatch beside their heron, follow in a line behind it inside its run,
// and leave with a spark. Pure.

/** Sprite pixels between chicks in the line. */
const CHICK_GAP = 7;
/** How much of the way they catch up in a second. */
const FOLLOW = 6;

/** Where chick i wants to be: in line behind the heron, inside its run. */
function placeOf(c: Crew, i: number, heron: Point): Point {
  let x = c.dir > 0 ? heron.x - (i + 1) * CHICK_GAP : heron.x + HERON_W + 1 + i * CHICK_GAP;
  if (!c.flying) x = clamp(x, c.spot.c0 * c.cellW, c.spot.c1 * c.cellW - CHICK_W);
  return { x, y: heron.y };
}

/** How many of the subagents' chicks follow the heron at index when a pane has herons of them, dealt out in turn. */
export function chickShare(subagents: number, herons: number, index: number): number {
  if (subagents <= 0 || herons <= 0 || index < 0 || index >= herons) return 0;
  return Math.floor((subagents - index + herons - 1) / herons);
}

/** As many chicks as want (at most CHICKS_MAX). */
export function chicksUpdate(c: Crew, want: number, dt: number, now: number): void {
  want = clamp(want, 0, CHICKS_MAX);
  const heron = heronAt(c, now);
  while (c.chicks.length < want) {
    c.chicks.push({ at: { x: heron.x + (HERON_W - CHICK_W) / 2, y: heron.y }, moving: false, born: now });
  }
  while (c.chicks.length > want) {
    const k = c.chicks.pop()!;
    puff(c, { x: k.at.x + 1, y: k.at.y - CHICK_H }, now);
  }
  const pull = Math.min(1, dt * FOLLOW);
  c.chicks.forEach((k, i) => {
    const to = placeOf(c, i, heron);
    k.moving = Math.abs(to.x - k.at.x) > 0.6 || Math.abs(to.y - k.at.y) > 0.6;
    k.at.x += (to.x - k.at.x) * pull;
    k.at.y += (to.y - k.at.y) * pull;
  });
}

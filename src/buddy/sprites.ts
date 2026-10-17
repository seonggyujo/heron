import { HERON_POSES, type HeronPose } from "./sprites-heron";

// The pixel pictures of the terminal herons: the heron's poses
// (sprites-heron.ts), its chicks, what it holds and the marks over its
// head. Each row is a string, one character per sprite pixel, facing right:
//   . clear       W body    G wing and crest    K eye    Y beak and legs
//   C chick down  N call mark (! and ?)         Z snore and thought
//   S sparkle     T twig
// pane/heron-paint.ts turns the letters into theme colors. Pure.

export type SpriteId = HeronPose | "chickStand" | "chickHop" | "chickSleep" | "bang" | "ask" | "snore" | "dot" | "spark" | "twig";

export interface Sprite {
  w: number;
  h: number;
  rows: readonly string[];
}

export { HERON_W, HERON_H } from "./sprites-heron";
export const CHICK_W = 6;
export const CHICK_H = 5;
/** The room a heron needs: its height and a mark over its head. */
export const STAGE_H = 21;

const SMALL: Record<Exclude<SpriteId, HeronPose>, readonly string[]> = {
  chickStand: [".CCC..", "CCCKY.", "CCCCC.", ".CCC..", ".Y.Y.."],
  chickHop: [".CCC..", "CCCKY.", "CCCCC.", ".CCC..", "......"],
  chickSleep: ["......", ".CCC..", "CCCCC.", "CCCCC.", ".CCC.."],
  bang: ["NN", "NN", "NN", "NN", "..", "NN"],
  ask: [".NN.", "N..N", "..N.", ".N..", "....", ".N.."],
  snore: ["ZZZZ", "..Z.", ".Z..", "ZZZZ"],
  // One of the three dots of a thinking heron.
  dot: ["ZZ", "ZZ"],
  spark: ["..S..", "..S..", "SSSSS", "..S..", "..S.."],
  // Held across the beak while the agent edits files.
  twig: ["....TT", "..TT..", "TT...."],
};

const sprite = (rows: readonly string[]): Sprite => ({ w: rows[0].length, h: rows.length, rows });

const SPRITES = new Map<SpriteId, Sprite>(
  [...Object.entries(HERON_POSES), ...Object.entries(SMALL)].map(([id, rows]) => [id as SpriteId, sprite(rows)]),
);

export function spriteOf(id: SpriteId): Sprite {
  return SPRITES.get(id)!;
}

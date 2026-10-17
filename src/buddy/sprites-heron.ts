// The heron's poses, 12 by 14 sprite pixels, facing right, feet on the
// bottom row. The letters are explained in sprites.ts. Pure.

export const HERON_W = 12;
export const HERON_H = 14;

export type HeronPose = "stand" | "walkA" | "walkB" | "peck" | "flyUp" | "flyDown" | "sleep" | "cheer";

// The head, the S of the neck and the body, the same while standing and
// walking.
const UPRIGHT = [
  "......WW....",
  "....GWWKYYYY",
  "......WW....",
  ".......W....",
  ".......W....",
  "......WW....",
  "......W.....",
  "..GGGWWW....",
  ".GGGGWWWW...",
  "GGGGGGWWW...",
  "..GGGGWW....",
];

const empty = (n: number) => Array<string>(n).fill("............");

export const HERON_POSES: Record<HeronPose, readonly string[]> = {
  stand: [...UPRIGHT, ".....Y.Y....", ".....Y.Y....", "....YY.YY..."],
  // Legs apart, then together.
  walkA: [...UPRIGHT, ".....Y..Y...", "....Y....Y..", "...YY....YY."],
  walkB: [...UPRIGHT, "......Y.....", "......Y.....", ".....YYY...."],
  // Head down at the ground.
  peck: [
    ...empty(7),
    "..GGGWW.....",
    ".GGGGWWWW...",
    "GGGGGGWWWW..",
    "..GGGGW..WW.",
    ".....Y.Y..WK",
    ".....Y.Y..WY",
    "....YY.YY..Y",
  ],
  flyUp: [
    ...empty(3),
    "....GG......",
    "....GGG.....",
    ".....GGG....",
    ".....GGG.WW.",
    "..WWWWWWWWKY",
    "YYYWWWWWWW..",
    "....WWWW....",
    ...empty(4),
  ],
  flyDown: [
    ...empty(6),
    ".........WW.",
    "..WWWWWWWWKY",
    "YYYWWWWWWW..",
    "....WGGGW...",
    ".....GGG....",
    ".....GG.....",
    "......G.....",
    ...empty(1),
  ],
  // On one leg, head tucked in.
  sleep: [
    ...empty(7),
    "......WWW...",
    "..GGGWGWY...",
    ".GGGGWWWW...",
    "GGGGGGWWW...",
    "..GGGGWW....",
    "......Y.....",
    ".....YYY....",
  ],
  // Wings up.
  cheer: [
    "......WW....",
    "G...GWWKYYYY",
    "GG....WW....",
    ".GG....W....",
    ".GGG...W....",
    "..GGG.WW....",
    "...GG.W.....",
    "..GGGWWW....",
    ".GGGGWWWW...",
    "..GGGGWWW...",
    "....GGWW....",
    ".....Y.Y....",
    ".....Y.Y....",
    "....YY.YY...",
  ],
};

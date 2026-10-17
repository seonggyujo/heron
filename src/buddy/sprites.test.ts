import { expect, test } from "vitest";
import { spriteOf, type SpriteId } from "./sprites";

test("every sprite row is as wide as the sprite, every heron pose 14 high", () => {
  const heron: SpriteId[] = ["stand", "walkA", "walkB", "peck", "flyUp", "flyDown", "sleep", "cheer"];
  const others: SpriteId[] = ["chickStand", "chickHop", "chickSleep", "bang", "ask", "snore", "dot", "spark", "twig"];
  for (const id of [...heron, ...others]) {
    const s = spriteOf(id);
    for (const row of s.rows) expect(row.length, id).toBe(s.w);
  }
  for (const id of heron) expect(spriteOf(id).h, id).toBe(14);
});

import { expect, test } from "vitest";
import { formatTokens, tokensOf, totalOf } from "./tokens";

test("backend data is checked; a missing turn counts as zero", () => {
  const r = tokensOf({ session: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 }, turn: null, complete: true });
  expect(totalOf(r.session)).toBe(10);
  expect(totalOf(r.turn)).toBe(0);
  expect(r.complete).toBe(true);
  expect(tokensOf("x").complete).toBe(false);
});

test("short form: three significant digits at most", () => {
  const n = [950, 1_234, 12_345, 123_456, 1_240_000, 12_400_000, 124_000_000, 2_500_000_000];
  expect(n.map(formatTokens)).toEqual(["950", "1.2k", "12.3k", "123k", "1.24M", "12.4M", "124M", "2.50B"]);
});

import { expect, test } from "vitest";
import { applyStatus } from "./agent-reports";

// The heron-limits status file applied to an agent: context use and effort.

test("takes the context use and the effort of the status file", () => {
  const a = applyStatus(undefined, { context: 34, effort: "high" }, 0);
  expect([a.context, a.effort]).toEqual([34, "high"]);
});

test("a model without an effort setting leaves it unknown", () => {
  const a = applyStatus(undefined, { context: 34, effort: null }, 0);
  expect(a.effort).toBeNull();
});

test("the same figures again keep the agent, so nothing redraws", () => {
  const a = applyStatus(undefined, { context: 34, effort: "high" }, 0);
  expect(applyStatus(a, { context: 34, effort: "high", at: 5 }, 1)).toBe(a);
});

test("a new effort alone is a change", () => {
  const a = applyStatus(undefined, { context: 34, effort: "high" }, 0);
  const b = applyStatus(a, { context: 34, effort: "max" }, 1);
  expect(b).not.toBe(a);
  expect(b.effort).toBe("max");
});

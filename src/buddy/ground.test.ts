// heron-c's tests/test_buddy_ground.c, against the TypeScript port.
import { expect, test } from "vitest";
import { groundFind, groundFree, groundRun } from "./ground";
import { FakeScreen } from "./test-kit";

test("room is found on blank cells, bottom first", () => {
  const t = new FakeScreen(40, 10);
  expect(groundFind(t, 4, 2, "home", 0, 0, 0)).toEqual({ row: 9, c0: 0, c1: 40 });
  expect(groundFind(t, 4, 2, "any", 0, 0, 3)?.row, "the fourth of nine").toBe(4);
  t.put(9, 0, "hello");
  expect(groundFind(t, 4, 2, "home", 0, 0, 0)).toEqual({ row: 9, c0: 5, c1: 40 });
  expect(groundFree(t, 4, 9)).toBe(false);
  expect(groundFree(t, 5, 9)).toBe(true);
  expect(groundRun(t, 9, 2, 6, 8)).toEqual({ row: 9, c0: 5, c1: 40 });
  expect(groundRun(t, 9, 2, 3, 6)).toBeNull();
});

test("the cursor and the two cells after it are never ground", () => {
  const t = new FakeScreen(40, 10);
  t.cursor = { row: 2, col: 9, shown: true };
  expect([groundFree(t, 9, 2), groundFree(t, 11, 2), groundFree(t, 12, 2)]).toEqual([false, false, true]);
});

test("near looks above and below the given row", () => {
  const t = new FakeScreen(40, 10);
  t.fillRows(5, 5);
  expect(groundFind(t, 4, 2, "near", 0, 2, 0)?.row).toBe(2);
  expect(groundFind(t, 4, 2, "near", 0, 5, 0)?.row).toBe(4);
  expect(groundFind(t, 4, 2, "near", 0, 8, 0)?.row).toBe(8);
});

test("a full screen has no room", () => {
  const t = new FakeScreen(10, 3);
  t.fillRows(0, 2);
  expect(groundFind(t, 3, 2, "home", 0, 0, 0)).toBeNull();
});

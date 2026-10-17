import { expect, test } from "vitest";
import { taskbarOf } from "./taskbar-state";

test("no bar and no number while nobody works", () => {
  expect(taskbarOf([])).toEqual({ bar: "none", working: 0 });
  expect(taskbarOf(["idle", "done", "waiting"])).toEqual({ bar: "none", working: 0 });
});

test("a moving bar and the number of working agents", () => {
  expect(taskbarOf(["working", "idle", "working"])).toEqual({ bar: "working", working: 2 });
});

test("an agent that needs the user wins the bar, the number still counts the working ones", () => {
  expect(taskbarOf(["working", "permission"])).toEqual({ bar: "needs", working: 1 });
  expect(taskbarOf(["question"])).toEqual({ bar: "needs", working: 0 });
});

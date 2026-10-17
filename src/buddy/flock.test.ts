import { expect, test } from "vitest";
import { crewUpdate, newCrew } from "./crew";
import { chickShare } from "./crew-chicks";
import { Flock, type FlockAgent } from "./flock";
import { HERON_W, type SpriteId } from "./sprites";
import { CELL, crewInput, FakeScreen } from "./test-kit";

const HERON_POSES: SpriteId[] = ["stand", "walkA", "walkB", "peck", "flyUp", "flyDown"];

test("chicks are dealt out over the herons, the first ones get the rest", () => {
  expect([0, 1, 2].map((i) => chickShare(2, 3, i))).toEqual([1, 1, 0]);
  expect([0, 1].map((i) => chickShare(5, 2, i))).toEqual([3, 2]);
  expect([chickShare(4, 1, 0), chickShare(0, 3, 0), chickShare(3, 3, 3)]).toEqual([4, 0, 0]);
});

test("herons arrive one by one and stand side by side", () => {
  const input = crewInput(new FakeScreen(60, 12), { state: "idle" });
  let now = 1000;
  const first = newCrew(7, 0, now);
  const second = newCrew(8, 1, now);
  crewUpdate(first, input, now);
  crewUpdate(second, input, now);
  expect([first.placed, second.placed]).toEqual([true, false]);
  for (let i = 0; i < 20; i++) {
    now += 33;
    crewUpdate(first, input, now);
    crewUpdate(second, input, now);
  }
  expect(second.placed).toBe(true);
  expect(second.spot.row).toBe(first.spot.row);
  expect(Math.abs(second.at.x - first.at.x)).toBeGreaterThanOrEqual(HERON_W);
});

test("as many herons as asked, the extra fade out, all go with the agent", () => {
  const screen = new FakeScreen(80, 12);
  const flock = new Flock();
  const agent: FlockAgent = { state: "working", doing: "edit", subagents: 3 };
  let now = 0;
  const steps = (ms: number, a: FlockAgent | null, want: number) => {
    for (let t = 0; t < ms; t += 33) {
      now += 33;
      flock.step(a, want, screen, CELL, now);
    }
  };
  const herons = () => flock.pose(now).filter((p) => HERON_POSES.includes(p.sprite)).length;
  const chicks = () => flock.pose(now).filter((p) => p.sprite.startsWith("chick")).length;

  steps(3000, agent, 3);
  expect(herons()).toBe(3);
  expect(chicks(), "one chick per subagent").toBe(3);
  expect(flock.pose(now).some((p) => p.sprite === "twig")).toBe(true);
  steps(1000, agent, 1);
  expect(herons(), "fewer asked for").toBe(1);
  steps(1000, null, 1);
  expect(flock.empty, "the agent left").toBe(true);
  expect(flock.wait(now)).toBe(0);
});

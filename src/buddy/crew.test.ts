// heron-c's tests/test_buddy_crew.c against the TypeScript port, and how a
// heron acts out what the agent does.
import { expect, test } from "vitest";
import { crewDone, crewUpdate, newCrew } from "./crew";
import { crewWait } from "./crew-pose";
import { FRAME_MS, type Crew, type CrewInput } from "./crew-state";
import { groundFree } from "./ground";
import { HERON_W } from "./sprites";
import { countPose, crewInput, FakeScreen, runCrew } from "./test-kit";

/** The heron stands on blank cells, its whole height clear. */
function onBlank(c: Crew, input: CrewInput): boolean {
  const row = Math.trunc(c.at.y / input.cellH + 0.5) - 1;
  const col0 = Math.trunc(c.at.x / input.cellW + 0.01);
  const col1 = Math.trunc((c.at.x + HERON_W) / input.cellW - 0.01);
  for (let y = row - 2; y <= row; y++) {
    for (let x = col0; x <= col1; x++) if (!groundFree(input.screen, x, y)) return false;
  }
  return true;
}

test("moods, moves and chicks follow the agent", () => {
  const t = new FakeScreen(60, 12);
  const clock = { now: 1000 };
  const c = newCrew(7, 0, clock.now);
  const input = crewInput(t);
  crewUpdate(c, input, clock.now);
  expect([c.mood, c.placed, c.flying, c.spot.row], "flies in, to the bottom").toEqual(["busy", true, true, 11]);
  runCrew(c, input, clock, 1500);
  expect([c.flying, c.opacity, onBlank(c, input)]).toEqual([false, 1, true]);
  expect(crewWait(c, clock.now)).toBe(FRAME_MS);
  let x = c.at.x;
  runCrew(c, input, clock, 500);
  expect(c.at.x, "walking").not.toBe(x);

  // Text under it mid-frame is judged once the frame is complete.
  t.synchronized = true;
  t.fillRows(10, 11);
  runCrew(c, input, clock, 33);
  expect([c.flying, c.spot.row]).toEqual([false, 11]);
  t.synchronized = false;
  runCrew(c, input, clock, 33);
  expect([c.flying, c.spot.row], "flies to the nearest room").toEqual([true, 9]);
  runCrew(c, input, clock, 1500);
  expect([c.flying, onBlank(c, input)]).toEqual([false, true]);

  input.subagents = 2;
  runCrew(c, input, clock, 1000);
  expect(c.chicks.length).toBe(2);
  expect(countPose(c, clock.now, ["chickStand", "chickHop", "chickSleep"])).toBe(2);
  input.subagents = 0;
  runCrew(c, input, clock, 33);
  expect([c.chicks.length, c.puffs.length], "each chick leaves a spark").toEqual([0, 2]);

  input.state = "permission";
  runCrew(c, input, clock, 1500);
  x = c.at.x;
  runCrew(c, input, clock, 1000);
  expect([c.at.x, countPose(c, clock.now, ["bang"])], "stands still, calling with a !").toEqual([x, 1]);
  const wait = crewWait(c, clock.now);
  expect(wait > 0 && wait <= 400).toBe(true);

  input.state = "done";
  runCrew(c, input, clock, 33);
  expect(c.puffs.length, "cheers with three sparks").toBe(3);
  runCrew(c, input, clock, 3000);
  expect(crewWait(c, clock.now), "then stands still").toBe(0);

  input.state = "idle";
  runCrew(c, input, clock, 33);
  expect(countPose(c, clock.now, ["sleep"])).toBe(1);
  expect([countPose(c, clock.now, ["snore"]), crewWait(c, clock.now)], "sleeps and needs no frames").toEqual([1, 0]);

  t.fillRows(0, 11);
  runCrew(c, input, clock, 500);
  expect([c.placed, c.opacity], "no room at all: fades out").toEqual([false, 0]);
  t.clear();
  runCrew(c, input, clock, 300);
  expect([c.placed, c.flying], "room again: flies back in").toEqual([true, true]);

  input.present = false;
  runCrew(c, input, clock, 500);
  expect(crewDone(c), "the agent left").toBe(true);
});

test("thinking: stands still, dots come one by one", () => {
  const clock = { now: 1000 };
  const c = newCrew(7, 0, clock.now);
  const input = crewInput(new FakeScreen(60, 12));
  runCrew(c, input, clock, 1500);
  input.doing = "think";
  runCrew(c, input, clock, 2000);
  const x = c.at.x;
  runCrew(c, input, clock, 3000);
  expect(c.at.x).toBe(x);
  const dots = new Set<number>();
  for (let i = 0; i < 8; i++) {
    runCrew(c, input, clock, 175);
    dots.add(countPose(c, clock.now, ["dot"]));
  }
  expect([...dots].sort()).toEqual([0, 1, 2, 3]);
  const wait = crewWait(c, clock.now);
  expect(wait > 0 && wait <= 350).toBe(true);
});

test("editing: carries a twig", () => {
  const clock = { now: 1000 };
  const c = newCrew(7, 0, clock.now);
  const input = crewInput(new FakeScreen(60, 12), { doing: "edit" });
  let twigs = 0;
  for (let i = 0; i < 60; i++) {
    runCrew(c, input, clock, 100);
    twigs += countPose(c, clock.now, ["twig"]);
  }
  expect(twigs).toBeGreaterThan(30);
});

test("a command running: runs, faster than while writing", () => {
  const walked = (doing: "run" | "write") => {
    const c = newCrew(9, 0, 0);
    runCrew(c, crewInput(new FakeScreen(200, 12), { doing }), { now: 0 }, 20000);
    return c.walked;
  };
  expect(walked("run")).toBeGreaterThan(walked("write") * 1.5);
});

test("on the web: flies about", () => {
  const c = newCrew(11, 0, 0);
  const input = crewInput(new FakeScreen(200, 24), { doing: "web" });
  const clock = { now: 0 };
  let flights = 0;
  let wasFlying = false;
  for (let i = 0; i < 600; i++) {
    runCrew(c, input, clock, 33);
    if (c.flying && !wasFlying) flights++;
    wasFlying = c.flying;
  }
  expect(flights, "flights in 20 s").toBeGreaterThanOrEqual(3);
});

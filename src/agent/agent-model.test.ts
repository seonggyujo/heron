import { expect, test } from "vitest";
import { applyInput, applyState, applyTitle, markOf, newAgent, readTitle, wantsAttention } from "./agent-model";

test("Claude Code's terminal title: a turning half circle works, ✳ is idle, others are not Claude Code", () => {
  expect(readTitle("◐ Fix the login")).toEqual({ working: true, title: "Fix the login" });
  expect(readTitle("✳ Fix the login")).toEqual({ working: false, title: "Fix the login" });
  expect(readTitle("PowerShell")).toBeNull();
});

test("by title alone: working, then done; idle when nothing was working", () => {
  const working = applyTitle(undefined, "◑ Fix", 1)!;
  expect([working.state, working.title, working.since]).toEqual(["working", "Fix", 1]);
  expect(applyTitle(working, "✳ Fix", 5)!.state).toBe("done");
  expect(applyTitle(undefined, "✳ Fix", 1)!.state).toBe("idle");
  expect(applyTitle(working, "C:\\Windows", 5), "another title changes nothing").toBe(working);
});

test("the same title again keeps the same agent, so nothing redraws", () => {
  const a = applyTitle(undefined, "◐ Fix", 1)!;
  expect(applyTitle(a, "◓ Fix", 2)).toBe(a);
});

test("once a hook reported, hooks decide the state, not the title", () => {
  const hooked = applyState(undefined, { state: "permission", message: "Bash", cwd: "C:\\repo", session_id: "s1" }, 1)!;
  expect([hooked.state, hooked.message, hooked.cwd, hooked.sessionId, hooked.fromHooks]).toEqual([
    "permission",
    "Bash",
    "C:\\repo",
    "s1",
    true,
  ]);
  expect(applyTitle(hooked, "◐ Fix", 2)!.state).toBe("permission");
  expect(applyState(hooked, { state: "ended" }, 3), "the session ended").toBeNull();
  expect(applyState(hooked, { state: "nonsense" }, 3), "an unknown state changes nothing").toBe(hooked);
});

test("keys: an answer goes on working, Esc or Ctrl+C stops the turn", () => {
  const asking = { ...newAgent(0), state: "permission" as const };
  expect(applyInput(asking, 1, false).state).toBe("working");
  expect(applyInput(asking, 1, true).state).toBe("idle");
  expect(applyInput({ ...newAgent(0), state: "working" }, 1, true).state).toBe("idle");
  const done = { ...newAgent(0), state: "done" as const };
  expect(applyInput(done, 1, false)).toBe(done);
});

test("the taskbar flashes when an agent starts needing you or finishes", () => {
  expect(wantsAttention("working", "permission")).toBe(true);
  expect(wantsAttention("working", "done")).toBe(true);
  expect(wantsAttention("permission", "question"), "still needs you: no second flash").toBe(false);
  expect(wantsAttention("idle", "working")).toBe(false);
  expect(markOf("waiting")).toBe("done");
});

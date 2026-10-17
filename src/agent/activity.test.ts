import { expect, test } from "vitest";
import { activityOf, doingOf, toolKind, toolLabel } from "./activity";

test("backend data is checked: bad turns dropped, a tool step needs a tool", () => {
  const a = activityOf({
    step: { kind: "tool", tool: "Edit", target: "main.ts", at: 5 },
    turn: [{ tool: "Edit", target: "main.ts", at: 5, done: false }, { at: 1 }, "x"],
  });
  expect(a.step).toEqual({ kind: "tool", tool: "Edit", target: "main.ts", at: 5 });
  expect(a.turn).toHaveLength(1);
  expect(activityOf(null).step).toBeNull();
  expect(activityOf({ step: { kind: "tool" } }).step).toBeNull();
});

test("what the agent does, for the sidebar color and the heron", () => {
  expect(doingOf({ kind: "tool", tool: "Edit", target: "main.ts", at: 5 })).toBe("edit");
  expect(doingOf({ kind: "thinking", at: 0 })).toBe("think");
  expect(doingOf(null)).toBeNull();
});

test("tools sorted into kinds; MCP tools show their own name", () => {
  expect(toolKind("Grep")).toBe("search");
  expect(toolKind("mcp__github__create_issue")).toBe("other");
  expect(toolLabel("mcp__github__create_issue")).toBe("create_issue");
});

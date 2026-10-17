import { expect, test } from "vitest";
import type { RecentSession } from "../ipc/sessions";
import { folderKey, groupByFolder } from "./session-groups";

const session = (id: string, cwd: string, modified: number): RecentSession => ({ id, cwd, title: id, modified });

test("one group per folder, case and a trailing backslash aside; the newest folder last", () => {
  const groups = groupByFolder([
    session("a", "C:\\repo", 30),
    session("b", "C:\\other", 10),
    session("c", "c:\\Repo\\", 20),
  ]);
  expect(groups.map((g) => g.sessions.map((s) => s.id))).toEqual([["b"], ["c", "a"]]);
  expect(groups[1].cwd, "as the newest session wrote it").toBe("C:\\repo");
  expect(groups[1].modified).toBe(30);
  expect(folderKey("C:\\Repo\\")).toBe(folderKey("c:\\repo"));
});

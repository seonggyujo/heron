import { expect, test } from "vitest";
import { gridRows } from "./grid";

test("panes per row: as square as can be, a short last row", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 10].map(gridRows)).toEqual([
    [],
    [1],
    [2],
    [2, 1],
    [2, 2],
    [3, 2],
    [3, 3],
    [3, 3, 1],
    [4, 4, 2],
  ]);
});

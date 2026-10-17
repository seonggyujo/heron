import { expect, test } from "vitest";
import { formatResetIn, formatUptime } from "./durations";

test("uptime: seconds, then minutes and seconds, then hours and minutes", () => {
  expect([42_000, 187_000, 3_840_000].map(formatUptime)).toEqual(["42s", "3m 07s", "1h 04m"]);
});

test("time to a limit reset: rounded minutes, hours, days; never negative", () => {
  expect([720, 7980, 273_600, -30].map(formatResetIn)).toEqual(["12m", "2h 13m", "3d 4h", "0m"]);
});

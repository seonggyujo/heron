import { expect, test } from "vitest";
import { modelLabel } from "./model-label";

test("model ids as the sidebar shows them", () => {
  expect(modelLabel("claude-opus-5-5")).toBe("Opus 5.5");
  expect(modelLabel("claude-sonnet-5-5[1m]")).toBe("Sonnet 5.5 1M");
  expect(modelLabel("claude-haiku-5-5-20260301")).toBe("Haiku 5.5");
  expect(modelLabel("claude-opus-5")).toBe("Opus 5");
  expect(modelLabel("opus")).toBe("Opus");
  expect(modelLabel("claude-fable-5-1")).toBe("Fable 5.1");
});

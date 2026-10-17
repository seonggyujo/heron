import { defineConfig } from "vitest/config";

// Unit tests of the frontend's pure modules (`npm test`): src/**/*.test.ts,
// each next to the module it tests. plugin/ keeps its own node:test tests.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

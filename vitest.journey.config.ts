import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for journey (cross-role E2E) tests.
 *
 * Usage: npm run test:journeys
 *
 * Runs ONLY the journey test files, sequentially, with no coverage.
 * Separated from the main config so `npm test` excludes journeys.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/journeys/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    isolate: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: false,
      },
    },
    sequence: {
      concurrent: false,
    },
  },
});

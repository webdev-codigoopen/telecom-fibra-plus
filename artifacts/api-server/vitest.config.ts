import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    reporters: ["default"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
  resolve: {
    conditions: ["workspace"],
  },
});

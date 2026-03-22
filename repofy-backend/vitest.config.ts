import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    setupFiles: ["./tests/setup.ts"],
    mockReset: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: {
        lines: 79,
        functions: 79,
        branches: 72,
        statements: 79,
      },
    },
  },
});

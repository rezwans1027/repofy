import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      testMatch: /auth-guard\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: "authenticated",
      testMatch: /.*(?<!auth-guard)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "cd ../repofy-backend && MOCK_AI=true npm run dev",
      port: 3003,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      port: 3002,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

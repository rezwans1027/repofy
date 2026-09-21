import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["**/foundation/**", "**/selection/**", "**/readiness/**"], // Separate local synthetic harnesses; no hosted credentials.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    // This suite uses an actual dedicated account session. Network traces can
    // retain its cookies/tokens; synthetic Feature 1 artifacts live separately.
    trace: "off",
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
      command: "cd ../repofy-backend && npm run dev",
      port: 3101,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      port: 3100,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

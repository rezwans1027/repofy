import { defineConfig } from "@playwright/test";

// HTTP smoke tests of the production Next.js build. No real identity, database or browser required.
export default defineConfig({
  testDir: "e2e/foundation",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3190" },
  webServer: [
    { command: "node e2e/foundation/capabilities-server.mjs", url: "http://127.0.0.1:3191/api/v1/capabilities", reuseExistingServer: false },
    {
      command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3190",
      url: "http://127.0.0.1:3190/login", reuseExistingServer: false,
      env: { API_BACKEND_URL: "http://127.0.0.1:3191/api", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});

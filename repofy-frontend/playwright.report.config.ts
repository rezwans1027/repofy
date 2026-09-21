import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e/readiness', workers: 1, fullyParallel: false, forbidOnly: !!process.env.CI, reporter: 'list', timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:3190', headless: true, actionTimeout: 15000, viewport: { width: 1280, height: 1000 }, trace: 'off', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'cd ../repofy-backend && node scripts/db/test-postgres.mjs --readiness-e2e', url: 'http://127.0.0.1:3191/api/v1/capabilities', reuseExistingServer: false, timeout: 60000, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 } },
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3190', url: 'http://127.0.0.1:3190/login', reuseExistingServer: false,
      env: { API_BACKEND_URL: 'http://127.0.0.1:3191/api', NEXT_TELEMETRY_DISABLED: '1' } },
  ],
});

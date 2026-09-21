import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e/selection', workers: 1, fullyParallel: false, forbidOnly: !!process.env.CI, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3190', headless: true, viewport: { width: 1280, height: 1000 } },
  webServer: [
    { command: 'node --import ../repofy-backend/node_modules/tsx/dist/loader.mjs ../repofy-backend/tests/e2e/selection-server.ts', url: 'http://127.0.0.1:3191/api/v1/capabilities', reuseExistingServer: false, timeout: 60000 },
    { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3190', url: 'http://127.0.0.1:3190/login', reuseExistingServer: false,
      env: { API_BACKEND_URL: 'http://127.0.0.1:3191/api', NEXT_TELEMETRY_DISABLED: '1' } },
  ],
});

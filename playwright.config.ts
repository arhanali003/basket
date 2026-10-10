import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  webServer: process.env.CI
    ? [
        {
          command: 'node --import tsx apps/api/src/main.ts',
          env: { TSX_TSCONFIG_PATH: 'apps/api/tsconfig.json' },
          url: 'http://localhost:4000/api/v1/ready',
          timeout: 120000,
          reuseExistingServer: false,
        },
        ...['storefront', 'admin', 'delivery'].map((app, index) => ({
          // Exercise the storefront's deployed assets. Staff UI uses local-only demo sign-in.
          command: `node node_modules/next/dist/bin/next ${app === 'storefront' ? 'start' : 'dev'} apps/${app} ${app === 'storefront' ? '' : '--webpack'} --port ${3000 + index}`,
          url: `http://localhost:${3000 + index}`,
          timeout: 120000,
          reuseExistingServer: false,
        })),
      ]
    : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

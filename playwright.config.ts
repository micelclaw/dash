import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests for Micelclaw Dash.
 *
 * By default, tests run against the dev server (VITE_MOCK_API=true)
 * so no backend is required. Set E2E_BASE_URL to test against a
 * live instance.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7150',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'VITE_MOCK_API=true npx vite --port 7150 --strictPort',
        url: 'http://localhost:7150',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Contract tests for Micelclaw Dash.
 *
 * Runs WITHOUT VITE_MOCK_API so the API client makes real fetch() calls
 * that Playwright's page.route() can intercept and record via ApiSpy.
 *
 * Usage:
 *   pnpm contracts          # run all contract tests
 *   pnpm contracts -- --grep "notes"   # run only notes contracts
 */
export default defineConfig({
  testDir: './e2e/contracts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:7151',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'contracts',
      testMatch: '*.contract.spec.ts',
      use: { ...devices['Desktop Chromium'] },
    },
  ],

  // Dev server WITHOUT mock mode — API calls go to fetch() → intercepted by page.route()
  webServer: {
    command: 'npx vite --port 7151 --strictPort',
    url: 'http://localhost:7151',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

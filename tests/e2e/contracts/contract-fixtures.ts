/**
 * Shared fixtures for contract tests.
 *
 * Provides a `spy` (ApiSpy) fixture and a helper to set up
 * base + domain mocks with authentication.
 */

import { test as base, expect, type Page } from '@playwright/test';
import { ApiSpy, type MockRoute } from '../helpers/api-spy';
import { baseMocks } from '../helpers/domain-mocks/base.mock';

/**
 * Set up API mocks and perform login via the UI.
 *
 * 1. Registers all page.route() intercepts (base + domain mocks)
 * 2. Injects auth state into localStorage (zustand persist key: 'claw-auth')
 * 3. The page is ready to navigate to any protected route
 */
async function setupAuth(page: Page, spy: ApiSpy, domainMocks: MockRoute[]) {
  const allMocks = [...baseMocks, ...domainMocks];
  await spy.setup(page, allMocks, { passthrough: false });

  // Inject auth state into localStorage BEFORE the app renders.
  // 1. addInitScript ensures the script runs before any page JS.
  // 2. Navigate to about:blank to trigger the init script and seed localStorage.
  // 3. After this, any goto('/protected-route') will find auth already in place.
  await page.addInitScript(() => {
    const authState = JSON.stringify({
      state: {
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        },
        user: {
          id: 'user-1',
          email: 'paco@local',
          display_name: 'Paco',
          role: 'owner',
          tier: 'pro',
        },
        isAuthenticated: true,
      },
      version: 0,
    });
    localStorage.setItem('claw-auth', authState);
  });

  // Seed localStorage by navigating to the app origin so the init script executes.
  await page.goto('/');
  await page.waitForTimeout(300);
}

export const test = base.extend<{
  spy: ApiSpy;
}>({
  spy: async ({}, use) => {
    const spy = new ApiSpy();
    await use(spy);
  },
});

export { expect };

/**
 * Helper to set up a page with auth + base mocks + domain mocks.
 */
export async function setupContractPage(
  page: Page,
  spy: ApiSpy,
  domainMocks: MockRoute[],
) {
  await setupAuth(page, spy, domainMocks);
}

/**
 * Navigate to a module page and wait for all API calls to settle.
 * Use this instead of raw `page.goto()` + `waitForTimeout()`.
 */
export async function gotoModule(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

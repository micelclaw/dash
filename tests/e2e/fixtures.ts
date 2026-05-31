/**
 * Shared Playwright fixtures for Micelclaw Dash E2E tests.
 *
 * - `authedPage`: a Page already logged in (mock mode injects auth state).
 * - `settingsPage`: navigated to /settings with the given section visible.
 * - Helper selectors and utilities.
 */

import { test as base, expect, type Page } from '@playwright/test';
import { setupWave5Mocks } from './helpers/api-mocks';

// ─── Auth fixture ──────────────────────────────────────────

/**
 * In mock mode the app auto-logs in when it detects VITE_MOCK_API.
 * We navigate to /settings (a safe page) and fill the login form if needed.
 */
async function login(page: Page) {
  // Set up all API mocks BEFORE navigation so route intercepts are ready
  await setupWave5Mocks(page);

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Fill login form (mock mode: paco@local / any password)
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ timeout: 10_000 });
  await emailInput.fill('paco@local');
  await page.locator('input[type="password"]').first().fill('test1234');
  await page.locator('button[type="submit"]').first().click();

  // Wait for navigation to complete after login
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

// ─── Navigate to settings section ──────────────────────────

async function goToSettings(page: Page, section: string) {
  await page.goto('/settings');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Click the sidebar item for the given section
  const sidebarItem = page.locator(`text="${section}"`).first();
  if (await sidebarItem.isVisible()) {
    await sidebarItem.click();
    await page.waitForTimeout(300); // animation settle
  }
}

// ─── Extended test fixture ─────────────────────────────────

export const test = base.extend<{
  authedPage: Page;
}>({
  authedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };

// ─── Selector helpers ──────────────────────────────────────

export const selectors = {
  /** Find a settings section by its title text */
  settingsSection: (page: Page, title: string) =>
    page.locator(`text="${title}"`).first().locator('..').locator('..'),

  /** Find a button by its text content */
  button: (page: Page, text: string) =>
    page.locator(`button:has-text("${text}")`).first(),

  /** Find an input by label text */
  inputByLabel: (page: Page, label: string) =>
    page.locator(`text="${label}"`).first().locator('..').locator('input, select').first(),

  /** Find a toggle/switch near a label */
  toggleByLabel: (page: Page, label: string) =>
    page.locator(`text="${label}"`).first().locator('..').locator('..').locator('button, [role="switch"], input[type="checkbox"]').first(),

  /** Find a select dropdown by label */
  selectByLabel: (page: Page, label: string) =>
    page.locator(`text="${label}"`).first().locator('..').locator('..').locator('select').first(),
};

// ─── Utility helpers ───────────────────────────────────────

export async function navigateToSettings(page: Page, section: string) {
  await goToSettings(page, section);
}

/** Wait for a toast notification containing text */
export async function waitForToast(page: Page, text: string) {
  await page.locator(`[data-sonner-toast]:has-text("${text}")`).first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {
      // Sonner may use different selectors
      return page.locator(`text="${text}"`).first().waitFor({ timeout: 3_000 });
    });
}

/** Check that text is visible on the page */
export async function expectVisible(page: Page, text: string) {
  await expect(page.locator(`text="${text}"`).first()).toBeVisible({ timeout: 5_000 });
}

/** Check that a section with the given heading exists */
export async function expectSection(page: Page, title: string) {
  await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
}

/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Quick screenshot tour of every Activity tab after the histogram
 * refactor — adaptive granularity, gap-fill, dot fallback for sparse
 * datasets. One PNG per tab for visual review.
 *
 * Run with:
 *   E2E_BASE_URL=http://127.0.0.1:7100 \
 *     pnpm exec playwright test e2e/histogram-bonito.spec.ts \
 *     --project=firefox --reporter=list
 */

import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:7100';
const PACO_EMAIL = 'paco@claw.local';
const PACO_PASSWORD = 'ClawPaco1@!';
const SHOTS = 'e2e/screenshots/histogram-bonito';

async function loginAsPaco(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    .first();
  await emailInput.waitFor({ timeout: 10_000 });
  await emailInput.fill(PACO_EMAIL);
  await page.locator('input[type="password"]').first().fill(PACO_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
}

const TABS = ['events', 'notifications', 'gateway', 'containers', 'core'] as const;

test('tour 5 tabs — chart should be visible everywhere', async ({ page }) => {
  await loginAsPaco(page);
  for (const tab of TABS) {
    await page.goto(`${BASE_URL}/activity?tab=${tab}`);
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});
    // Wait for the chart container to settle.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${tab}.png`, fullPage: false });
  }
});

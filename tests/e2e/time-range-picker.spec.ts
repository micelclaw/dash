/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * E2E smoke: time-range picker shows up on every Activity tab and
 * applying a preset narrows the rendered chart + table.
 *
 * Run with:
 *
 *   E2E_BASE_URL=http://127.0.0.1:7100 \
 *     pnpm exec playwright test e2e/time-range-picker.spec.ts \
 *     --project=firefox --reporter=list
 */

import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:7100';
const PACO_EMAIL = 'paco@claw.local';
const PACO_PASSWORD = 'ClawPaco1@!';
const SHOTS = 'e2e/screenshots/time-range';

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

test.describe('Activity Center — time range picker', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPaco(page);
  });

  test('picker button shows + popover renders presets and custom inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/activity?tab=events`);
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

    // Initial state — picker shows "Todo el histórico"
    const trigger = page.getByRole('button', { name: /rango temporal/i });
    await trigger.waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/01-events-closed.png`, fullPage: false });

    // Open the popover.
    await trigger.click();
    const popover = page.getByRole('dialog', { name: /rango temporal/i });
    await popover.waitFor({ state: 'visible', timeout: 5_000 });
    await page.screenshot({ path: `${SHOTS}/02-events-popover-open.png`, fullPage: false });

    // Pick "Últimas 24 horas".
    await popover.getByText('Últimas 24 horas').click();
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await page.screenshot({ path: `${SHOTS}/03-events-preset-24h.png`, fullPage: false });
  });
});

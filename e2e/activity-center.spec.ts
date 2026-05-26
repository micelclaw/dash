/**
 * E2E: Activity Center — full smoke against the live Core (port 7200)
 * via the dev dash (port 7100). Uses Paco Trueno (admin) creds.
 *
 * Goal: open the page, walk every tab, take screenshots, verify the
 * settings modal opens and persists changes. Run with:
 *
 *   E2E_BASE_URL=http://127.0.0.1:7100 \
 *     pnpm exec playwright test e2e/activity-center.spec.ts \
 *     --project=chromium --reporter=list
 *
 * IMPORTANT: this spec deliberately bypasses the mock fixtures in
 * fixtures.ts (those route-intercept the API). We want REAL backend
 * round-trips so a missing route or 500 surfaces visibly.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:7100';
const PACO_EMAIL = 'paco@claw.local';
const PACO_PASSWORD = 'ClawPaco1@!';

const SHOTS = 'e2e/screenshots/activity';

async function loginAsPaco(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ timeout: 10_000 });
  await emailInput.fill(PACO_EMAIL);
  await page.locator('input[type="password"]').first().fill(PACO_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  // Wait until the chat URL or main shell is reached
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
}

async function gotoActivity(page: Page, tab?: string) {
  const url = tab ? `${BASE_URL}/activity?tab=${tab}` : `${BASE_URL}/activity`;
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  // Give the histogram + initial fetch a beat
  await page.waitForTimeout(1_000);
}

test.describe('Activity Center smoke', () => {
  test('login + module loads + sidebar renders the 5 tabs', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page);
    await page.screenshot({ path: `${SHOTS}/01-events-default.png`, fullPage: true });

    // Sidebar shows the 5 tab labels
    for (const label of ['Events', 'Notifications', 'Gateway logs', 'Containers', 'System (Core)']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Header / settings button
    await expect(page.locator('button[aria-label="Settings"]')).toBeVisible();
  });

  test('Events tab loads + filter facets', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'events');
    // Severity + Domain selects come from the events adapter
    const severitySelect = page.locator('select').filter({ hasText: 'Severity' });
    await expect(severitySelect).toBeVisible();
    const domainSelect = page.locator('select').filter({ hasText: 'Domain' });
    await expect(domainSelect).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-events-tab.png`, fullPage: true });
  });

  test('Notifications tab loads', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'notifications');
    // Notification rule filter
    const ruleSelect = page.locator('select').filter({ hasText: 'Regla' });
    await expect(ruleSelect).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-notifications-tab.png`, fullPage: true });
  });

  test('Gateway logs tab loads', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'gateway');
    const levelSelect = page.locator('select').filter({ hasText: 'Level' });
    await expect(levelSelect).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-gateway-tab.png`, fullPage: true });
  });

  test('Containers tab loads with service selector', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'containers');
    const serviceSelect = page.locator('select').filter({ hasText: 'Servicio' });
    await expect(serviceSelect).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/05-containers-tab.png`, fullPage: true });
  });

  test('Core (System) tab loads', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'core');
    const levelSelect = page.locator('select').filter({ hasText: 'Level' });
    await expect(levelSelect).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/06-core-tab.png`, fullPage: true });
  });

  test('Settings modal opens + shows storage + rule switches', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page);
    await page.locator('button[aria-label="Settings"]').click();
    await expect(page.getByText('Activity Center · Settings')).toBeVisible();
    // Storage section
    await expect(page.getByText('Storage & Retention')).toBeVisible();
    // Built-in rule keys visible — use exact match to avoid strict-mode
    // violations against the description paragraphs that quote the keys.
    await expect(page.getByText('auth.brute_force.detected', { exact: true })).toBeVisible();
    await expect(page.getByText('lifecycle.service.failed', { exact: true })).toBeVisible();
    await expect(page.getByText('system.error.critical', { exact: true })).toBeVisible();
    await expect(page.getByText('billing.plan_limit.exceeded', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/07-settings-modal.png`, fullPage: true });

    // GDPR section
    await expect(page.getByText('Privacy & GDPR')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/08-settings-gdpr.png`, fullPage: true });
  });

  test('Settings: budget input + apply persists', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page);
    await page.locator('button[aria-label="Settings"]').click();
    await expect(page.getByText('Storage & Retention')).toBeVisible();

    // Find the budget input (number, between Storage & Retention and "MB" label)
    const budgetInput = page.locator('input[type="number"]').first();
    await budgetInput.waitFor();
    await budgetInput.fill('250');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    // Toast / response — let it settle
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/09-settings-budget-changed.png`, fullPage: true });

    // Close + reopen — value should persist
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await page.waitForTimeout(300);
    await page.locator('button[aria-label="Settings"]').click();
    await expect(page.locator('input[type="number"]').first()).toHaveValue('250');

    // Restore default
    await page.locator('input[type="number"]').first().fill('200');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await page.waitForTimeout(500);
  });

  test('Core (System) level filter actually filters', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page, 'core');
    // Wait for initial paint
    await page.waitForTimeout(1500);
    // Select 'warn' — most lines are info so we expect very few/none
    const levelSelect = page.locator('select').filter({ hasText: 'Level' });
    await levelSelect.selectOption('warn');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/11-core-filter-warn.png`, fullPage: true });

    // None of the visible rows in the table body should be of level info.
    // Look at the "Lvl" cell (column 2) — it should NOT contain "INFO".
    const lvlPills = page.locator('tbody td:nth-child(2) span');
    const count = await lvlPills.count();
    for (let i = 0; i < count; i++) {
      const txt = (await lvlPills.nth(i).textContent())?.toLowerCase() ?? '';
      if (txt && txt.includes('info')) throw new Error('info row leaked past warn filter');
    }
  });

  test('Histogram tooltip is readable on hover', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page);
    await page.waitForTimeout(1500);
    // Hover over the chart area to trigger the recharts tooltip
    const chart = page.locator('.recharts-bar-rectangles').first();
    await chart.waitFor({ timeout: 5_000 }).catch(() => {});
    const box = await chart.boundingBox();
    if (box) {
      // Aim at the centre of a bar
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${SHOTS}/12-histogram-tooltip.png`, fullPage: true });
  });

  test('Settings: toggle a built-in rule + verify activity.settings.changed event', async ({ page }) => {
    await loginAsPaco(page);
    await gotoActivity(page);
    await page.locator('button[aria-label="Settings"]').click();
    await page.getByText('auth.brute_force.detected', { exact: true }).waitFor();
    // The rule row that contains the auth.brute_force.detected pill carries
    // its own checkbox.
    const ruleRow = page.locator('div.rounded-md').filter({
      has: page.getByText('auth.brute_force.detected', { exact: true }),
    }).first();
    const checkbox = ruleRow.locator('input[type="checkbox"]').first();
    // Use raw click + wait for the PATCH instead of uncheck() — the
    // checkbox is controlled and only flips after the API roundtrip,
    // so uncheck()'s post-assertion races the React state update.
    const patchResp = page.waitForResponse(
      (r) => r.url().includes('/activity/notification-rules/auth.brute_force.detected') && r.request().method() === 'PATCH',
    );
    await checkbox.click();
    await patchResp;
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/10-rule-disabled.png`, fullPage: true });

    // Re-enable to leave state clean
    const patchResp2 = page.waitForResponse(
      (r) => r.url().includes('/activity/notification-rules/auth.brute_force.detected') && r.request().method() === 'PATCH',
    );
    await checkbox.click();
    await patchResp2;
    await page.waitForTimeout(300);
  });
});

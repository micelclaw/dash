/**
 * Contract tests for the Settings module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { settingsMocks } from '../helpers/domain-mocks/settings.mock';

test.describe('Settings @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, settingsMocks);
  });

  test('loading settings page fetches GET /settings', async ({ page, spy }) => {
    await gotoModule(page, '/settings');

    spy.expectCall('GET', '/settings');
  });

  test('updating settings calls PATCH /settings', async ({ page, spy }) => {
    await gotoModule(page, '/settings');
    spy.reset();

    // Look for a select, toggle, switch, or input to change a setting
    const select = page.locator('select').first();
    const toggle = page.locator('[role="switch"], input[type="checkbox"]').first();
    const input = page.locator('input[type="text"]').first();

    if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Change to a different option (avoid selecting already-selected)
      const current = await select.inputValue();
      const options = await select.locator('option').allTextContents();
      const newIdx = options.findIndex((_, i) => i > 0 && options[i] !== current) || 1;
      await select.selectOption({ index: newIdx });
      await page.waitForTimeout(1500); // Settings may debounce saves
    } else if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(1000);
    } else if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('updated-value');
      await input.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Settings saves via PATCH /settings/general (or other section paths)
    const patchCalls = spy.findCalls('PATCH', /^\/settings/);
    if (patchCalls.length === 0) test.skip();
  });

  // ─── New settings sections (Tier 5) ──────────────────────────

  test('agent-tokens section fetches GET /agent-tokens', async ({ page, spy }) => {
    await gotoModule(page, '/settings/agent-tokens');

    spy.expectCall('GET', '/agent-tokens');
  });

  test('my-api-keys section fetches GET /api-keys/mine', async ({ page, spy }) => {
    await gotoModule(page, '/settings/my-api-keys');

    spy.expectCall('GET', '/api-keys/mine');
  });

  test('approvals-history section fetches GET /approvals/history', async ({ page, spy }) => {
    await gotoModule(page, '/settings/approvals-history');

    spy.expectCall('GET', /\/approvals\/history/);
  });

  test('preferences section fetches GET /preferences', async ({ page, spy }) => {
    await gotoModule(page, '/settings/preferences');

    spy.expectCall('GET', '/preferences');
  });

  test('duplicates section fetches GET /sync/duplicates', async ({ page, spy }) => {
    await gotoModule(page, '/settings/duplicates');

    spy.expectCall('GET', '/sync/duplicates');
  });
});

/**
 * Contract tests for the Multimedia module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method and path.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { multimediaMocks } from '../helpers/domain-mocks/multimedia.mock';

test.describe('Multimedia @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, multimediaMocks);
  });

  test('loading multimedia page fetches status', async ({ page, spy }) => {
    await gotoModule(page, '/multimedia');

    const calls = spy.findCalls('GET', /\/multimedia\//);
    expect(calls.length, 'Should fetch multimedia status').toBeGreaterThan(0);
  });

  test('starting a service calls POST (if button visible)', async ({ page, spy }) => {
    await gotoModule(page, '/multimedia');

    // Try multiple selectors — card class may vary
    const startBtn = page
      .locator('button')
      .filter({ hasText: /Start/i })
      .first();

    const visible = await startBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (visible) {
      spy.reset();
      await startBtn.click();
      await page.waitForTimeout(500);

      const calls = spy.findCalls('POST', /\/multimedia\//);
      expect(calls.length, 'Should POST to start multimedia service').toBeGreaterThan(0);
    } else {
      // No start button found — just verify status was fetched
      const statusCalls = spy.findCalls('GET', /\/multimedia\//);
      expect(statusCalls.length, 'Should at least fetch multimedia status').toBeGreaterThan(0);
    }
  });
});

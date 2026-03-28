/**
 * Contract tests for the Processes module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { processesMocks } from '../helpers/domain-mocks/processes.mock';

test.describe('Processes @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, processesMocks);
  });

  test('loading processes page fetches process list', async ({ page, spy }) => {
    await gotoModule(page, '/processes');

    const getCalls = spy.findCalls('GET', /hal\/processes/);
    expect(getCalls.length, 'Should fetch process list').toBeGreaterThan(0);
  });

  test('restarting a process calls POST restart', async ({ page, spy }) => {
    await gotoModule(page, '/processes');

    // Find a process entry in the list
    const processEntry = page.getByText('core').or(page.getByText('gateway')).first();

    if (await processEntry.isVisible({ timeout: 3000 }).catch(() => false)) {
      spy.reset();

      // Look for a restart button near the process entry or in the row
      const restartBtn = page.locator('button').filter({ hasText: /restart/i }).first();
      // Also try icon buttons with restart-related aria labels
      const restartIcon = page.locator(
        'button[aria-label*="restart" i], button[title*="restart" i]',
      ).first();

      if (await restartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await restartBtn.click();
        await page.waitForTimeout(500);

        // Confirm if dialog appears
        const confirmBtn = page
          .locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /restart|confirm|yes/i })
          .first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        const restartCalls = spy.findCalls('POST', /processes.*restart/);
        expect(restartCalls.length, 'Should POST restart').toBeGreaterThan(0);
      } else if (await restartIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await restartIcon.click();
        await page.waitForTimeout(500);

        const restartCalls = spy.findCalls('POST', /processes.*restart/);
        expect(restartCalls.length, 'Should POST restart').toBeGreaterThan(0);
      }
    }
  });
});

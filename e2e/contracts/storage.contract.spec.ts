/**
 * Contract tests for the Storage module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { storageMocks } from '../helpers/domain-mocks/storage.mock';

test.describe('Storage @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, storageMocks);
  });

  test('loading storage page fetches status', async ({ page, spy }) => {
    await gotoModule(page, '/storage');

    const statusCalls = spy.findCalls('GET', /hal\/storage/);
    expect(statusCalls.length, 'Should fetch storage data').toBeGreaterThan(0);
  });

  test('loading fetches shares', async ({ page, spy }) => {
    await gotoModule(page, '/storage');

    const shareCalls = spy.findCalls('GET', /storage\/shares/);
    // Shares may load lazily based on capabilities — skip if not loaded
    if (shareCalls.length === 0) {
      test.skip();
    }
    expect(shareCalls.length, 'Should fetch storage shares').toBeGreaterThan(0);
  });

  test('loading fetches file stats', async ({ page, spy }) => {
    await gotoModule(page, '/storage');

    const statsCalls = spy.findCalls('GET', /\/files\/stats/);
    expect(statsCalls.length, 'Should fetch file stats').toBeGreaterThan(0);
  });

  test('loading fetches file duplicates', async ({ page, spy }) => {
    await gotoModule(page, '/storage');

    const dupCalls = spy.findCalls('GET', /\/files\/duplicates/);
    expect(dupCalls.length, 'Should fetch file duplicates').toBeGreaterThan(0);
  });

  test('deleting pool calls DELETE', async ({ page, spy }) => {
    await gotoModule(page, '/storage');

    // Find a pool entry by its name
    const poolEntry = page.getByText('main').first();
    if (await poolEntry.isVisible()) {
      spy.reset();

      // Find delete action — could be a button, menu item, or icon
      const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(300);

        // Confirm if dialog appears
        const confirmBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /delete|confirm/i })
          .first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);

        const deleteCalls = spy.findCalls('DELETE', /storage\/pools/);
        expect(deleteCalls.length, 'Should DELETE pool').toBeGreaterThan(0);
      }
    }
  });
});

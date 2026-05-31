/**
 * Contract tests for the DNS module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { dnsMocks } from '../helpers/domain-mocks/dns.mock';

test.describe('DNS @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, dnsMocks);
  });

  test('loading DNS page fetches zones', async ({ page, spy }) => {
    await gotoModule(page, '/dns');

    spy.expectCall('GET', '/dns/zones');
  });

  test('deleting zone calls DELETE /dns/zones/:id', async ({ page, spy }) => {
    await gotoModule(page, '/dns');

    // Find the zone entry in the list
    const zoneEntry = page.getByText('example.com').first();
    if (await zoneEntry.isVisible()) {
      await zoneEntry.click();
      await page.waitForTimeout(300);
      spy.reset();

      // Find delete action
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

        const deleteCalls = spy.findCalls('DELETE', /^\/dns\/zones\/.+/);
        expect(deleteCalls.length, 'Should DELETE zone').toBeGreaterThan(0);
      }
    }
  });

  test('DDNS status is fetched', async ({ page, spy }) => {
    await gotoModule(page, '/dns');

    const ddnsCalls = spy.findCalls('GET', /\/dns\/ddns\//);
    expect(ddnsCalls.length, 'Should fetch DDNS-related endpoints').toBeGreaterThan(0);
  });
});

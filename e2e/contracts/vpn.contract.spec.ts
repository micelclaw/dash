/**
 * Contract tests for the VPN module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { vpnMocks } from '../helpers/domain-mocks/vpn.mock';

test.describe('VPN @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, vpnMocks);
  });

  test('loading VPN page fetches status', async ({ page, spy }) => {
    await gotoModule(page, '/vpn');

    spy.expectCall('GET', '/hal/network/vpn/status');
  });

  test('loading VPN fetches peers', async ({ page, spy }) => {
    await gotoModule(page, '/vpn');

    const peerCalls = spy.findCalls('GET', /vpn\/peers|wg-easy/);
    expect(peerCalls.length, 'Should fetch peers or wg-easy clients').toBeGreaterThan(0);
  });

  test('deleting peer calls DELETE', async ({ page, spy }) => {
    await gotoModule(page, '/vpn');

    // Find the peer entry "Phone"
    const peerEntry = page.getByText('Phone').first();
    if (await peerEntry.isVisible()) {
      spy.reset();

      // Find and click the delete button near the peer
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

        const deleteCalls = spy.findCalls('DELETE', /vpn\/peers/);
        expect(deleteCalls.length, 'Should DELETE peer').toBeGreaterThan(0);
      }
    }
  });

  test('restarting VPN calls POST restart', async ({ page, spy }) => {
    await gotoModule(page, '/vpn');

    const restartBtn = page.locator('button').filter({ hasText: /restart/i }).first();
    if (await restartBtn.isVisible()) {
      spy.reset();
      await restartBtn.click();
      await page.waitForTimeout(500);

      const restartCalls = spy.findCalls('POST', /vpn\/restart/);
      expect(restartCalls.length, 'Should POST restart').toBeGreaterThan(0);
    }
  });
});

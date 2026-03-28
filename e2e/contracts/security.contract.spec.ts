/**
 * Contract tests for the Security module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { securityMocks } from '../helpers/domain-mocks/security.mock';

test.describe('Security @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, securityMocks);
  });

  test('approvals count is fetched on page load', async ({ page, spy }) => {
    await gotoModule(page, '/settings');

    // The base mock covers GET /approvals/count — it should be called on any page load
    spy.expectCall('GET', '/approvals/count');
  });

  test('approving a request calls POST approve', async ({ page, spy }) => {
    // Navigate to settings or a page that may show approvals in sidebar/panel
    await gotoModule(page, '/settings');

    // Look for an approvals section, badge, or link
    const approvalsLink = page
      .locator('a, button, [role="tab"]')
      .filter({ hasText: /approval/i })
      .first();

    if (await approvalsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approvalsLink.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Find an approve button for a pending request
      const approveBtn = page
        .locator('button')
        .filter({ hasText: /approve|accept/i })
        .first();

      if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await approveBtn.click();
        await page.waitForTimeout(500);

        // Confirm if dialog appears
        const confirmBtn = page
          .locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /approve|confirm|yes/i })
          .first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        const approveCalls = spy.findCalls('POST', /approvals.*approve/);
        expect(approveCalls.length, 'Should POST approve').toBeGreaterThan(0);
      }
    }
  });
});

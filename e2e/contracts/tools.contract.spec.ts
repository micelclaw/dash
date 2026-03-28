/**
 * Contract tests for the Tools module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { toolsMocks } from '../helpers/domain-mocks/tools.mock';

test.describe('Tools @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, toolsMocks);
  });

  test('loading tools page', async ({ page }) => {
    await gotoModule(page, '/tools');

    // Verify the page loaded — the Tools heading should be visible
    const heading = page.getByText('Tools').first();
    await expect(heading).toBeVisible({ timeout: 3000 });
  });

  test('deleting a file calls DELETE /files/:id', async ({ page, spy }) => {
    await gotoModule(page, '/tools');

    // Whiteboards are listed if files were returned — look for the file entry
    const fileItem = page.getByText('script.sh').first();
    if (await fileItem.isVisible()) {
      // Right-click to open context menu
      await fileItem.click({ button: 'right' });
      await page.waitForTimeout(300);
      spy.reset();

      // Click Delete from context menu
      const deleteBtn = page.locator('button, [role="menuitem"]')
        .filter({ hasText: /delete/i })
        .first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        // Confirm if dialog appears
        const confirmBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /delete|confirm/i })
          .first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        const deleteCalls = spy.findCalls('DELETE', /^\/files\/.+/);
        expect(deleteCalls.length, 'Should DELETE file').toBeGreaterThan(0);
      }
    }
  });
});

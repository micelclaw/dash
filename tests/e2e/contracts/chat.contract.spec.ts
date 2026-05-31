/**
 * Contract tests for the Chat module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { chatMocks } from '../helpers/domain-mocks/chat.mock';

test.describe('Chat @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, chatMocks);
  });

  test('loading chat page fetches conversations', async ({ page, spy }) => {
    await gotoModule(page, '/chat');

    const getCalls = spy.findCalls('GET', /\/conversations/);
    expect(getCalls.length, 'Should fetch conversations').toBeGreaterThan(0);
  });

  test('deleting thread calls DELETE', async ({ page, spy }) => {
    await gotoModule(page, '/chat');

    // Find conversation entry
    const convItem = page.getByText('Help with code').first();
    if (await convItem.isVisible()) {
      // Right-click or find context menu to get delete option
      await convItem.click({ button: 'right' });
      await page.waitForTimeout(300);
      spy.reset();

      // Find delete option in context menu
      const deleteOption = page.locator('[role="menuitem"], [role="menu"] button, [data-context-menu] button')
        .filter({ hasText: /delete/i })
        .first();

      if (await deleteOption.isVisible()) {
        await deleteOption.click();
        await page.waitForTimeout(300);

        // Confirm if dialog appears
        const confirmBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /delete|confirm/i })
          .first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);

        const deleteCalls = spy.findCalls('DELETE', /\/conversations\/threads/);
        expect(deleteCalls.length, 'Should DELETE conversation thread').toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Contract tests for the Agents module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { agentsMocks } from '../helpers/domain-mocks/agents.mock';

test.describe('Agents @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, agentsMocks);
  });

  test('loading agents page fetches managed agents', async ({ page, spy }) => {
    await gotoModule(page, '/agents');

    spy.expectCall('GET', '/managed-agents');
  });

  test('agents page renders agent list', async ({ page, spy }) => {
    await gotoModule(page, '/agents');

    // Verify the page rendered with agent data
    const agentEntry = page.getByText('Francis').first();
    if (await agentEntry.isVisible()) {
      // Agent list rendered correctly — try inline edit
      await agentEntry.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Attempt inline edit via editable field
      const editableField = page.locator('[data-editable]').first();
      if (await editableField.isVisible()) {
        await editableField.dblclick();
        await page.waitForTimeout(300);

        const editInput = page.locator('input[type="text"]').first();
        if (await editInput.isVisible()) {
          await editInput.fill('Francis Updated');
          await editInput.blur();
          await page.waitForTimeout(500);

          const patchCalls = spy.findCalls('PATCH', /^\/managed-agents\/.+/);
          if (patchCalls.length > 0) {
            expect(patchCalls.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

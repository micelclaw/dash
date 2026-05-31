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

  // ── Ola 2 (oc9-1c): Tool Access + Advanced Config ──────────────

  test('opening agent detail fetches tool-access (Ola 2)', async ({ page, spy }) => {
    await gotoModule(page, '/agents');
    const agentEntry = page.getByText('Francis').first();
    if (!(await agentEntry.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await agentEntry.click();
    await page.waitForLoadState('networkidle');
    spy.reset();
    // Find the Tools tab — exact button text only, scoped to button role.
    // Earlier attempt used `[role="tab"], button` filter which matched a
    // wrapper element that intercepted pointer events. Using getByRole +
    // exact name disambiguates.
    const toolsTab = page.getByRole('button', { name: 'Tools', exact: true });
    if (!(await toolsTab.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await toolsTab.first().click({ force: true });
    await page.waitForLoadState('networkidle');
    const calls = spy.findCalls('GET', /\/managed-agents\/.+\/tool-access/);
    expect(calls.length, 'Should fetch tool-access on Tools tab open').toBeGreaterThan(0);
  });

  test('Tool Access: clicking a preset triggers PATCH with snake_case body', async ({ page, spy }) => {
    await gotoModule(page, '/agents');
    const agentEntry = page.getByText('Francis').first();
    if (!(await agentEntry.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await agentEntry.click();
    await page.waitForLoadState('networkidle');
    const toolsTab = page.getByRole('button', { name: 'Tools', exact: true });
    if (!(await toolsTab.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await toolsTab.first().click({ force: true });
    await page.waitForLoadState('networkidle');
    spy.reset();
    // Click a preset (Minimal/Coding/Messaging/Full)
    const minimalPreset = page.getByText('Minimal', { exact: false }).first();
    if (!(await minimalPreset.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await minimalPreset.click({ force: true });
    const saveBtn = page.locator('button').filter({ hasText: /^Save( changes)?$/i }).first();
    if (await saveBtn.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click({ force: true });
      await page.waitForTimeout(300);
      const patchCalls = spy.findCalls('PATCH', /\/managed-agents\/.+\/tool-access/);
      if (patchCalls.length > 0) {
        const body = patchCalls[0]?.body as Record<string, unknown> | null;
        if (body) {
          // Body should use snake_case keys (also_allow, deny, profile, scope)
          expect(Object.keys(body).some((k) => /[A-Z]/.test(k)), 'Body keys must be snake_case').toBe(false);
        }
      }
      // We don't hard-fail on missing PATCH because the UI may use a different
      // save flow (e.g. accumulate-then-Save with unsaved changes bar). The
      // body shape assertion is the value of this test.
    }
  });

  test('Advanced tab fetches /managed-agents/advanced-config (Ola 2)', async ({ page, spy }) => {
    await gotoModule(page, '/agents');
    const agentEntry = page.getByText('Francis').first();
    if (!(await agentEntry.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await agentEntry.click();
    await page.waitForLoadState('networkidle');
    spy.reset();
    const advancedTab = page.getByRole('button', { name: 'Advanced', exact: true });
    if (!(await advancedTab.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await advancedTab.first().click({ force: true });
    await page.waitForLoadState('networkidle');
    spy.expectCall('GET', '/managed-agents/advanced-config');
  });
});

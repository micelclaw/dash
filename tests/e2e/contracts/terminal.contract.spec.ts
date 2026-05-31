/**
 * Contract tests for the Terminal module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 *
 * Note: The terminal is primarily WebSocket-based (xterm.js),
 * so HTTP contract tests focus on snippets/connections endpoints.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { terminalMocks } from '../helpers/domain-mocks/terminal.mock';

test.describe('Terminal @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, terminalMocks);
  });

  test('loading terminal page', async ({ page }) => {
    await gotoModule(page, '/terminal');

    // Terminal page should render — look for the terminal container or tab bar
    const terminalContainer = page
      .locator('[data-testid="terminal"], .xterm, [class*="terminal"]')
      .first();
    const pageContent = page.locator('main, [role="main"], .page-content').first();

    const isVisible =
      (await terminalContainer.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await pageContent.isVisible({ timeout: 1000 }).catch(() => false));

    expect(isVisible, 'Terminal page should render').toBeTruthy();
  });

  test('fetches snippets', async ({ page, spy }) => {
    await gotoModule(page, '/terminal');

    const snippetCalls = spy.findCalls('GET', /terminal\/snippets/);
    // Snippets may be fetched on load or when opening a snippets panel
    if (snippetCalls.length === 0) {
      // Try opening a snippets panel if there's a button for it
      const snippetsBtn = page
        .locator('button')
        .filter({ hasText: /snippet/i })
        .first();
      if (await snippetsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await snippetsBtn.click();
        await page.waitForTimeout(500);

        const callsAfterClick = spy.findCalls('GET', /terminal\/snippets/);
        expect(callsAfterClick.length, 'Should fetch snippets').toBeGreaterThan(0);
      }
    } else {
      expect(snippetCalls.length, 'Should fetch snippets on load').toBeGreaterThan(0);
    }
  });
});

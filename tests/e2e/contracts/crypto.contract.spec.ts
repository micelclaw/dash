/**
 * Contract tests for the Crypto module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method and path.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { cryptoMocks } from '../helpers/domain-mocks/crypto.mock';

test.describe('Crypto @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, cryptoMocks);
  });

  test('loading crypto page fetches status', async ({ page, spy }) => {
    await gotoModule(page, '/crypto');

    spy.expectCall('GET', '/crypto/status');
  });

  test('starting bitcoind calls POST', async ({ page, spy }) => {
    await gotoModule(page, '/crypto');

    // Find the Bitcoin Core card by its title text, then locate the Start button
    const btcCard = page.locator('.crypto-grid-nodes > div').filter({ hasText: /Bitcoin Core/i }).first();
    const startBtn = btcCard.locator('button[title="Start"]').first();

    if (await startBtn.isVisible({ timeout: 3000 })) {
      spy.reset();
      await startBtn.click();
      await page.waitForTimeout(500);

      const calls = spy.findCalls('POST', /\/crypto\/bitcoind\/start/);
      expect(calls.length, 'Should POST /crypto/bitcoind/start').toBeGreaterThan(0);
    }
  });

  test('starting lightning calls POST', async ({ page, spy }) => {
    await gotoModule(page, '/crypto');

    // Find the Core Lightning card, then locate the Start button
    const lnCard = page.locator('.crypto-grid-nodes > div').filter({ hasText: /Core Lightning/i }).first();
    const startBtn = lnCard.locator('button[title="Start"]').first();

    if (await startBtn.isVisible({ timeout: 3000 })) {
      spy.reset();
      await startBtn.click();
      await page.waitForTimeout(500);

      const calls = spy.findCalls('POST', /\/crypto\/lightning\/start/);
      expect(calls.length, 'Should POST /crypto/lightning/start').toBeGreaterThan(0);
    }
  });
});

/**
 * Contract tests for the Finance module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { financeMocks } from '../helpers/domain-mocks/finance.mock';

test.describe('Finance @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, financeMocks);
  });

  test('loading finance page', async ({ page, spy }) => {
    await gotoModule(page, '/finance/firefly');

    // The page should load and fetch the finance status
    const statusCalls = spy.findCalls('GET', /finance\/status/);
    expect(statusCalls.length, 'Should fetch finance status').toBeGreaterThan(0);
  });

  test('finance page fetches status on load', async ({ page, spy }) => {
    await gotoModule(page, '/finance/firefly');

    // FinanceEmbed is iframe-based — no start button in the DOM.
    // Verify the page loaded and fetched status.
    const statusCalls = spy.findCalls('GET', /finance\/status/);
    expect(statusCalls.length, 'Should fetch finance status on load').toBeGreaterThan(0);
  });
});

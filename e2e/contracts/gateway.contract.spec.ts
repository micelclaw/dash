/**
 * Contract tests for the Gateway module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { gatewayMocks } from '../helpers/domain-mocks/gateway.mock';

test.describe('Gateway @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, gatewayMocks);
  });

  test('loading gateway page fetches gateway endpoints', async ({ page, spy }) => {
    await gotoModule(page, '/gateway');

    const calls = spy.findCalls('GET', /\/gateway\//);
    expect(calls.length, 'Should fetch gateway endpoints on load').toBeGreaterThan(0);
  });
});

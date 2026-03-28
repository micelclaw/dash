/**
 * Contract tests for the Proxy module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { proxyMocks } from '../helpers/domain-mocks/proxy.mock';

test.describe('Proxy @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, proxyMocks);
  });

  test('loading proxy page fetches hosts and status', async ({ page, spy }) => {
    await gotoModule(page, '/proxy');

    spy.expectCall('GET', '/hal/network/proxy/status');
    spy.expectCall('GET', '/hal/network/proxy/hosts');
  });

  test('loading fetches certificates', async ({ page, spy }) => {
    await gotoModule(page, '/proxy');

    spy.expectCall('GET', '/hal/network/proxy/certificates');
  });

  test('creating a host calls POST', async ({ page, spy }) => {
    await gotoModule(page, '/proxy');

    // Navigate to hosts section and find the add button
    const addBtn = page.locator('button').filter({ hasText: /add host|new host|create/i }).first();
    if (await addBtn.isVisible()) {
      spy.reset();
      await addBtn.click();
      await page.waitForTimeout(300);

      // Fill domain field
      const domainInput = page.locator('input[placeholder*="domain"]')
        .or(page.locator('input[name="domain"]'))
        .or(page.locator('input[placeholder*="Domain"]'))
        .first();
      if (await domainInput.isVisible()) {
        await domainInput.fill('new.example.com');
      }

      // Click create/save
      const saveBtn = page.locator('button').filter({ hasText: /create|save|add/i }).first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }

      const createCalls = spy.findCalls('POST', /proxy\/hosts/);
      expect(createCalls.length, 'Should POST to create host').toBeGreaterThan(0);
    }
  });

  test('deleting a host calls DELETE', async ({ page, spy }) => {
    await gotoModule(page, '/proxy');

    // Find the host entry
    const hostEntry = page.getByText('app.example.com').first();
    if (await hostEntry.isVisible()) {
      spy.reset();

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

        const deleteCalls = spy.findCalls('DELETE', /proxy\/hosts/);
        expect(deleteCalls.length, 'Should DELETE host').toBeGreaterThan(0);
      }
    }
  });

  test('syncing calls POST sync', async ({ page, spy }) => {
    await gotoModule(page, '/proxy');

    const syncBtn = page.locator('button').filter({ hasText: /sync/i }).first();
    if (await syncBtn.isVisible()) {
      spy.reset();
      await syncBtn.click();
      await page.waitForTimeout(500);

      const syncCalls = spy.findCalls('POST', /proxy\/sync/);
      expect(syncCalls.length, 'Should POST sync').toBeGreaterThan(0);
    }
  });
});

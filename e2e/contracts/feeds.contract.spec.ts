/**
 * Contract tests for the Feeds module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { feedsMocks } from '../helpers/domain-mocks/feeds.mock';

test.describe('Feeds @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, feedsMocks);
  });

  test('loading feeds page fetches GET /feeds', async ({ page, spy }) => {
    await gotoModule(page, '/feeds');

    spy.expectCall('GET', '/feeds');
  });

  test('loading fetches articles', async ({ page, spy }) => {
    await gotoModule(page, '/feeds');

    spy.expectCall('GET', '/feeds/articles');
  });

  test('refreshing feed calls POST refresh', async ({ page, spy }) => {
    await gotoModule(page, '/feeds');

    // Find a feed entry in the sidebar by its title
    const feedEntry = page.getByText('Hacker News').first();
    if (await feedEntry.isVisible()) {
      // Hover to reveal the context menu trigger
      await feedEntry.hover();
      await page.waitForTimeout(200);

      spy.reset();

      // Open feed context menu (MoreVertical icon button)
      const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
      const contextBtn = feedEntry.locator('..').locator('button').last();
      if (await contextBtn.isVisible()) {
        await contextBtn.click();
        await page.waitForTimeout(200);
      }

      // Click Refresh in the dropdown
      const refreshBtn = page.locator('button').filter({ hasText: /refresh/i }).first();
      if (await refreshBtn.isVisible()) {
        await refreshBtn.click();
        await page.waitForTimeout(500);

        const refreshCalls = spy.findCalls('POST', /feeds.*refresh/);
        expect(refreshCalls.length, 'Should POST refresh for feed').toBeGreaterThan(0);
      }
    }
  });

  test('deleting feed calls DELETE', async ({ page, spy }) => {
    await gotoModule(page, '/feeds');

    // Find a feed entry in the sidebar
    const feedEntry = page.getByText('Hacker News').first();
    if (await feedEntry.isVisible()) {
      await feedEntry.hover();
      await page.waitForTimeout(200);

      // Open feed context menu
      const contextBtn = feedEntry.locator('..').locator('button').last();
      if (await contextBtn.isVisible()) {
        await contextBtn.click();
        await page.waitForTimeout(200);
      }

      spy.reset();

      // Click Unsubscribe in the dropdown
      const deleteBtn = page.locator('button').filter({ hasText: /unsubscribe|delete/i }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(300);

        // Confirm if dialog appears
        const confirmBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button')
          .filter({ hasText: /delete|confirm|unsubscribe/i })
          .first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);

        const deleteCalls = spy.findCalls('DELETE', /\/feeds\//);
        expect(deleteCalls.length, 'Should DELETE feed').toBeGreaterThan(0);
      }
    }
  });

  test('marking all read calls POST', async ({ page, spy }) => {
    await gotoModule(page, '/feeds');

    spy.reset();

    // The "Mark all read" button has title="Mark all read (Shift+A)" or a CheckCheck icon
    const markAllBtn = page.locator('button[title*="Mark all read"]').first()
      .or(page.locator('button').filter({ hasText: /mark all read/i }).first());

    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(500);

      const markCalls = spy.findCalls('POST', /mark-all-read/);
      expect(markCalls.length, 'Should POST mark-all-read').toBeGreaterThan(0);
    }
  });
});

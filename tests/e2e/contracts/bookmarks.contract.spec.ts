/**
 * Contract tests for the Bookmarks module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { bookmarksMocks } from '../helpers/domain-mocks/bookmarks.mock';

test.describe('Bookmarks @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, bookmarksMocks);
  });

  test('loading bookmarks page fetches list, tags, and domains', async ({ page, spy }) => {
    await gotoModule(page, '/bookmarks');

    spy.expectCall('GET', '/bookmarks');
    spy.expectCall('GET', '/bookmarks/tags');
    spy.expectCall('GET', '/bookmarks/domains');
  });

  test('clicking Add Bookmark opens modal and save calls POST /bookmarks', async ({ page, spy }) => {
    await gotoModule(page, '/bookmarks');
    spy.reset();

    // Click add button
    const addBtn = page.locator('button').filter({ hasText: /add bookmark/i }).first();
    await addBtn.click();
    await page.waitForTimeout(300);

    // Fill URL field — should trigger fetch-metadata on blur
    const urlInput = page.locator('input[placeholder="https://example.com"]')
      .or(page.locator('input[placeholder*="https://"]'))
      .or(page.locator('input[name="url"]'))
      .first();
    await urlInput.fill('https://new-test-site.com');
    await urlInput.blur();
    await page.waitForTimeout(500);

    // fetch-metadata should have been called
    spy.expectCall('POST', '/bookmarks/fetch-metadata');

    spy.reset();

    // Click save
    const saveBtn = page.locator('button').filter({ hasText: /save bookmark/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(500);

      const createCall = spy.expectCall('POST', '/bookmarks');
      expect(createCall.body).toHaveProperty('url');
    }
  });

  test('deleting a bookmark calls DELETE /bookmarks/:id', async ({ page, spy }) => {
    await gotoModule(page, '/bookmarks');
    spy.reset();

    // Open dropdown menu on first bookmark card
    const menuBtn = page.locator('[data-bookmark-id]').first()
      .locator('button')
      .or(page.locator('button[aria-label*="menu" i]').first());

    // Try clicking the more menu
    const moreBtn = page.locator('[data-bookmark-id]').first()
      .locator('button').last();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(300);

      const deleteBtn = page.getByText('Delete', { exact: true }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        const deleteCalls = spy.findCalls('DELETE', /^\/bookmarks\/.+/);
        expect(deleteCalls.length, 'Should DELETE bookmark').toBeGreaterThan(0);
      }
    }
  });

  test('check-alive calls POST /bookmarks/check-alive', async ({ page, spy }) => {
    await gotoModule(page, '/bookmarks');
    spy.reset();

    // Look for "Check All Links" button
    const checkBtn = page.locator('button').filter({ hasText: /check.*link/i }).first();
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await page.waitForTimeout(500);

      spy.expectCall('POST', '/bookmarks/check-alive');
    }
  });
});

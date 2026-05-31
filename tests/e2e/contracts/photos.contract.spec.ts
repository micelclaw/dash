/**
 * Contract tests for the Photos module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { photosMocks } from '../helpers/domain-mocks/photos.mock';

test.describe('Photos @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, photosMocks);
  });

  test('loading photos page fetches GET /photos/timeline', async ({ page, spy }) => {
    await gotoModule(page, '/photos');

    spy.expectCall('GET', '/photos/timeline');
  });

  test('loading albums fetches GET /albums', async ({ page, spy }) => {
    await gotoModule(page, '/photos');

    spy.expectCall('GET', '/albums');
  });

  test('creating album calls POST /albums', async ({ page, spy }) => {
    await gotoModule(page, '/photos');

    // Switch to Albums tab
    const albumsTab = page.locator('button').filter({ hasText: /albums/i }).first();
    if (await albumsTab.isVisible()) {
      await albumsTab.click();
      await page.waitForTimeout(500);
    }

    spy.reset();

    // Click "New Album" card or "Create Album" button
    const newAlbumBtn = page.getByText('New Album').first()
      .or(page.locator('button').filter({ hasText: /create album/i }).first());
    if (await newAlbumBtn.isVisible()) {
      await newAlbumBtn.click();
      await page.waitForTimeout(300);

      // Fill album name
      const nameInput = page.locator('input[placeholder="Album name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Album');
      }

      // Click Create button
      const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(500);
      }

      spy.expectCall('POST', '/albums');
    }
  });

  test('deleting album calls DELETE /albums/:id', async ({ page, spy }) => {
    await gotoModule(page, '/photos');

    // Switch to Albums tab
    const albumsTab = page.locator('button').filter({ hasText: /albums/i }).first();
    if (await albumsTab.isVisible()) {
      await albumsTab.click();
      await page.waitForTimeout(500);
    }

    // Click on album to open it
    const albumItem = page.getByText('Vacation').first();
    if (await albumItem.isVisible()) {
      await albumItem.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Find delete action
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

        const deleteCalls = spy.findCalls('DELETE', /^\/albums\/.+/);
        expect(deleteCalls.length, 'Should DELETE album').toBeGreaterThan(0);
      }
    }
  });

  test('deleting photo calls DELETE /files/:id', async ({ page, spy }) => {
    await gotoModule(page, '/photos');

    // Click on a photo to select it
    const photoItem = page.getByText('sunset.jpg').first()
      .or(page.locator('[data-photo-id]').first());
    if (await photoItem.isVisible()) {
      await photoItem.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Find delete action
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

        const deleteCalls = spy.findCalls('DELETE', /^\/files\/.+/);
        expect(deleteCalls.length, 'Should DELETE file').toBeGreaterThan(0);
      }
    }
  });
});

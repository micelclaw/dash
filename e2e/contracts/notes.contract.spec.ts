/**
 * Contract tests for the Notes module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { notesMocks } from '../helpers/domain-mocks/notes.mock';

test.describe('Notes @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, notesMocks);
  });

  test('loading the notes page fetches GET /notes', async ({ page, spy }) => {
    await gotoModule(page, '/notes');

    spy.expectCall('GET', '/notes');
  });

  test('clicking New Note calls POST /notes', async ({ page, spy }) => {
    await gotoModule(page, '/notes');
    spy.reset();

    // Click the new note button
    const newBtn = page.locator('button').filter({ hasText: /new note/i }).first();
    await newBtn.click();
    await page.waitForTimeout(500);

    spy.expectCall('POST', '/notes');
  });

  test('selecting a note fetches GET /notes/:id', async ({ page, spy }) => {
    await gotoModule(page, '/notes');
    spy.reset();

    // Click the first note in the list
    const noteItem = page.locator('[data-note-id]').first()
      .or(page.getByText('Test Note Alpha').first());
    if (await noteItem.isVisible()) {
      await noteItem.click();
      await page.waitForTimeout(500);

      const getCalls = spy.findCalls('GET', /^\/notes\/.+/);
      expect(getCalls.length, 'Should fetch note by ID').toBeGreaterThan(0);
    }
  });

  test('editing note title calls PATCH /notes/:id', async ({ page, spy }) => {
    await gotoModule(page, '/notes');

    // Select first note
    const noteItem = page.getByText('Test Note Alpha').first();
    if (await noteItem.isVisible()) {
      await noteItem.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Edit the title
      const titleInput = page.locator('input[placeholder="Untitled"]')
        .or(page.locator('[data-testid="note-title"]'))
        .first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Updated Title');
        await titleInput.blur();
        // Wait for debounced save (1500ms)
        await page.waitForTimeout(2000);

        const patchCalls = spy.findCalls('PATCH', /^\/notes\/.+/);
        expect(patchCalls.length, 'Should PATCH note on title change').toBeGreaterThan(0);
      }
    }
  });

  test('deleting a note calls DELETE /notes/:id', async ({ page, spy }) => {
    await gotoModule(page, '/notes');

    // Try right-click context menu on first note
    const noteItem = page.getByText('Test Note Alpha').first();
    if (await noteItem.isVisible()) {
      await noteItem.click({ button: 'right' });
      await page.waitForTimeout(300);
      spy.reset();

      // Look for Delete in context menu
      const deleteBtn = page.getByText('Delete', { exact: true }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(300);

        // Confirm in dialog if present
        const confirmBtn = page.locator('button').filter({ hasText: /delete|confirm/i }).last();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);

        const deleteCalls = spy.findCalls('DELETE', /^\/notes\/.+/);
        expect(deleteCalls.length, 'Should DELETE note').toBeGreaterThan(0);
      }
    }
  });
});

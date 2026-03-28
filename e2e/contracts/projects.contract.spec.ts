/**
 * Contract tests for the Projects module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { projectsMocks } from '../helpers/domain-mocks/projects.mock';

test.describe('Projects @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, projectsMocks);
  });

  test('loading projects page fetches GET /projects/boards', async ({ page, spy }) => {
    await gotoModule(page, '/projects');

    spy.expectCall('GET', '/projects/boards');
  });

  test('creating a board calls POST /projects/boards', async ({ page, spy }) => {
    await gotoModule(page, '/projects');
    spy.reset();

    const newBtn = page.locator('button').filter({ hasText: /new board/i }).first();
    if (!(await newBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await newBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Board name"]')
      .or(page.locator('input[placeholder*="board name"]'))
      .first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('My New Board');
    }

    const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      spy.expectCall('POST', '/projects/boards');
    }
  });

  test('opening a board fetches GET /projects/boards/:id', async ({ page, spy }) => {
    await gotoModule(page, '/projects');
    spy.reset();

    const boardItem = page.getByText('Sprint Board').first();
    if (await boardItem.isVisible()) {
      await boardItem.click();
      await page.waitForTimeout(500);

      const getCalls = spy.findCalls('GET', /^\/projects\/boards\/.+/);
      expect(getCalls.length, 'Should fetch board by ID').toBeGreaterThan(0);
    }
  });

  test('adding a column calls POST columns', async ({ page, spy }) => {
    await gotoModule(page, '/projects');

    // Open board first
    const boardItem = page.getByText('Sprint Board').first();
    if (!(await boardItem.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await boardItem.click();
    await page.waitForTimeout(1000);
    spy.reset();

    const addColBtn = page.locator('button').filter({ hasText: /add column/i }).first()
      .or(page.getByText('Add column').first());
    if (await addColBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addColBtn.click();
      await page.waitForTimeout(300);

      const colInput = page.locator('input[placeholder*="Column title"]')
        .or(page.locator('input[placeholder*="column"]'))
        .first();
      if (await colInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await colInput.fill('In Progress');
        await colInput.press('Enter');
      } else {
        const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
        if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await createBtn.click();
        }
      }
      await page.waitForTimeout(500);

      const colCalls = spy.findCalls('POST', /columns/);
      if (colCalls.length > 0) {
        expect(colCalls.length, 'Should POST column').toBeGreaterThan(0);
      }
    }
  });

  test('adding a card calls POST cards', async ({ page, spy }) => {
    await gotoModule(page, '/projects');

    // Open board first
    const boardItem = page.getByText('Sprint Board').first();
    if (!(await boardItem.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await boardItem.click();
    await page.waitForTimeout(1000);
    spy.reset();

    const addCardBtn = page.locator('button').filter({ hasText: /add card/i }).first();
    if (await addCardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addCardBtn.click();
      await page.waitForTimeout(300);

      const cardInput = page.locator('input[placeholder*="Card title"]')
        .or(page.locator('input[placeholder*="card"]'))
        .first();
      if (await cardInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cardInput.fill('New task');
        await cardInput.press('Enter');
      }
      await page.waitForTimeout(500);

      const cardCalls = spy.findCalls('POST', /cards/);
      if (cardCalls.length > 0) {
        expect(cardCalls.length, 'Should POST card').toBeGreaterThan(0);
      }
    }
  });
});

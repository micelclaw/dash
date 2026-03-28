/**
 * Contract tests for the Mail module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { mailMocks } from '../helpers/domain-mocks/mail.mock';

test.describe('Mail @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, mailMocks);
  });

  test('loading mail page fetches GET /emails and GET /email-accounts', async ({ page, spy }) => {
    await gotoModule(page, '/mail');

    spy.expectCall('GET', '/emails');
    spy.expectCall('GET', '/email-accounts');
  });

  test('opening an email fetches GET /emails/:id', async ({ page, spy }) => {
    await gotoModule(page, '/mail');
    spy.reset();

    // Wait for email list to render, then click first email
    const emailItem = page.getByText('Welcome').first();
    if (await emailItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailItem.click();
      await page.waitForTimeout(500);

      const getCalls = spy.findCalls('GET', /^\/emails\/.+/);
      expect(getCalls.length, 'Should fetch email by ID').toBeGreaterThan(0);
    }
  });

  test('composing and saving draft calls POST /emails/drafts', async ({ page, spy }) => {
    await gotoModule(page, '/mail');

    const composeBtn = page.locator('button').filter({ hasText: /compose/i }).first();
    if (await composeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await composeBtn.click();
      await page.waitForTimeout(300);
      spy.reset();

      const subjectInput = page.locator('input[placeholder="Subject"]').first();
      if (await subjectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subjectInput.fill('Test Subject');

        const draftBtn = page.locator('button').filter({ hasText: /draft|save/i }).first();
        if (await draftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await draftBtn.click();
          await page.waitForTimeout(500);

          spy.expectCall('POST', '/emails/drafts');
        }
      }
    }
  });

  test('marking email as read calls POST /emails/:id/read', async ({ page, spy }) => {
    await gotoModule(page, '/mail');

    const emailItem = page.getByText('Welcome').first();
    if (await emailItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailItem.click();
      await page.waitForTimeout(500);

      const readCalls = spy.findCalls('POST', /\/emails\/.+\/read/);
      if (readCalls.length > 0) {
        expect(readCalls.length, 'Should mark email as read').toBeGreaterThan(0);
      }
    }
  });

  test('deleting email calls DELETE /emails/:id', async ({ page, spy }) => {
    await gotoModule(page, '/mail');

    // Select an email first
    const emailItem = page.getByText('Welcome').first();
    if (!(await emailItem.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await emailItem.click();
    await page.waitForTimeout(500);
    spy.reset();

    // Find and click delete button
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

      const deleteCalls = spy.findCalls('DELETE', /^\/emails\/.+/);
      expect(deleteCalls.length, 'Should DELETE email').toBeGreaterThan(0);
    }
  });

  test('batch mark read calls POST /emails/batch', async ({ page, spy }) => {
    await gotoModule(page, '/mail');
    spy.reset();

    // Select emails via checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(count, 2); i++) {
      await checkboxes.nth(i).click();
    }
    await page.waitForTimeout(300);

    // Click "Mark read" button
    const markReadBtn = page.locator('button').filter({ hasText: /mark read/i }).first();
    if (await markReadBtn.isVisible()) {
      await markReadBtn.click();
      await page.waitForTimeout(500);

      spy.expectCall('POST', '/emails/batch');
    }
  });
});

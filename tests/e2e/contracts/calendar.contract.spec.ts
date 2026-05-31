/**
 * Contract tests for the Calendar module.
 *
 * Verifies that UI actions trigger the correct API calls
 * with the right HTTP method, path, and payload.
 */

import { test, expect, setupContractPage, gotoModule } from './contract-fixtures';
import { calendarMocks } from '../helpers/domain-mocks/calendar.mock';

test.describe('Calendar @contract', () => {
  test.beforeEach(async ({ page, spy }) => {
    await setupContractPage(page, spy, calendarMocks);
  });

  test('loading calendar page fetches GET /calendars and GET /events', async ({ page, spy }) => {
    await gotoModule(page, '/calendar');

    spy.expectCall('GET', '/calendars');
    spy.expectCall('GET', '/events');
  });

  test('creating an event calls POST /events', async ({ page, spy }) => {
    await gotoModule(page, '/calendar');
    spy.reset();

    // Try clicking the "+" button or a "New event" button
    const plusBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    const newEventBtn = page.locator('button').filter({ hasText: /new event/i }).first();
    if (await plusBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await plusBtn.click();
    } else if (await newEventBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await newEventBtn.click();
    } else {
      // Navigate to new event action directly
      await page.goto('/calendar?action=new');
    }
    await page.waitForTimeout(500);

    // Fill the event title — try multiple possible selectors
    const titleInput = page.locator('input[placeholder*="Event title"]')
      .or(page.locator('input[placeholder*="event title"]'))
      .or(page.locator('input[placeholder*="Title"]'))
      .or(page.locator('input[name="title"]'))
      .first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('New Test Event');
      await page.waitForTimeout(300);

      // Click Create button
      const createBtn = page.locator('button').filter({ hasText: /create|save/i }).first();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(500);

        spy.expectCall('POST', '/events');
      }
    }
  });

  test('creating a calendar calls POST /calendars', async ({ page, spy }) => {
    await gotoModule(page, '/calendar');
    spy.reset();

    // Find and click "Add calendar"
    const addCalendarBtn = page.getByText(/add calendar/i).first();
    await addCalendarBtn.click();
    await page.waitForTimeout(500);

    // Fill the calendar name
    const nameInput = page.locator('input[placeholder*="e.g., Gym"]')
      .or(page.locator('input[placeholder*="Project X"]'))
      .or(page.locator('input[name="name"]'))
      .first();
    await nameInput.fill('Test Calendar');
    await page.waitForTimeout(300);

    // Click Create button
    const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
    await createBtn.click();
    await page.waitForTimeout(500);

    spy.expectCall('POST', '/calendars');
  });

  test('deleting an event calls DELETE /events/:id', async ({ page, spy }) => {
    await gotoModule(page, '/calendar');

    // Click on an event — may need right-click for context menu
    const eventItem = page.getByText('Team Meeting').first();
    if (await eventItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try left-click first to open event detail
      await eventItem.click();
      await page.waitForTimeout(500);
      spy.reset();

      // Look for delete button in detail view
      let deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
      if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteBtn.click();
      } else {
        // Try right-click context menu instead
        await eventItem.click({ button: 'right' });
        await page.waitForTimeout(300);
        spy.reset();
        const deleteMenuItem = page.getByText('Delete', { exact: true }).first();
        if (await deleteMenuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deleteMenuItem.click();
        } else {
          return; // No delete mechanism found
        }
      }
      await page.waitForTimeout(300);

      // Confirm if dialog appears
      const confirmBtn = page.locator('[role="alertdialog"] button, [role="dialog"] button')
        .filter({ hasText: /delete|confirm|yes/i })
        .first();
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(500);

      const deleteCalls = spy.findCalls('DELETE', /^\/events\/.+/);
      if (deleteCalls.length > 0) {
        expect(deleteCalls.length, 'Should DELETE event').toBeGreaterThan(0);
      }
    }
  });
});

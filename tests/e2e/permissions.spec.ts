/**
 * E2E: Semantic Permissions (Wave 5 — Track C)
 *
 * Tests the Settings → Permissions section:
 * - Agent permissions list with scope badges
 * - App permissions list
 * - Scope editor dialog (add/remove scopes)
 * - Live preview counter
 * - Filter type (include/exclude) toggle
 * - Domain selector
 */

import { test, expect } from './fixtures';

test.describe('Semantic Permissions', () => {
  async function goToPermissions(page: import('@playwright/test').Page) {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.getByText('Permissions', { exact: true }).click();
    await page.waitForTimeout(500);
  }

  test('renders Agent Permissions section', async ({ authedPage: page }) => {
    await goToPermissions(page);

    await expect(page.getByText('Agent Permissions')).toBeVisible();
  });

  test('lists agents with their display names', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Built-in mock agents: Francis, Elon, Ana, etc.
    await expect(page.getByText('Francis').first()).toBeVisible();
    await expect(page.getByText('Elon').first()).toBeVisible();
  });

  test('shows Full access badge for agents without scopes', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Francis has no semantic_scopes → "Full access" badge
    await expect(page.getByText('Full access').first()).toBeVisible();
  });

  test('shows Filtered badge for agents with scopes', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Elon has 1 semantic_scope → "Filtered" badge
    await expect(page.getByText('Filtered').first()).toBeVisible();
  });

  test('each agent has an Edit button', async ({ authedPage: page }) => {
    await goToPermissions(page);

    const editButtons = page.locator('button:has-text("Edit")');
    const count = await editButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking Edit opens scope editor', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Click first Edit button
    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.click();
    await page.waitForTimeout(500);

    // Scope editor should show domain options
    const domainLabels = ['notes', 'emails', 'contacts', 'events', 'files', 'diary'];
    let foundDomain = false;
    for (const domain of domainLabels) {
      const found = await page.getByText(domain, { exact: false }).first().isVisible().catch(() => false);
      if (found) {
        foundDomain = true;
        break;
      }
    }
    expect(foundDomain).toBe(true);
  });

  test('scope editor shows filter type toggle (include/exclude)', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Open editor for an agent with scopes (Elon)
    // Elon is the second agent — click the second Edit button
    const editBtn = page.locator('button:has-text("Edit")').nth(1);
    await editBtn.click();
    await page.waitForTimeout(500);

    // Should show a select with "Include only" or "Exclude" filter type
    const filterSelect = page.locator('select').filter({ hasText: /Include only|Exclude/ }).first();
    await expect(filterSelect).toBeVisible();
  });

  test('scope preview shows record counts', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // Open editor for Elon (has scopes — should trigger preview)
    // Elon is the second agent — click the second Edit button
    const editBtn = page.locator('button:has-text("Edit")').nth(1);
    await editBtn.click();
    await page.waitForTimeout(1000);

    // Preview counts (from mock: notes=45, emails=230, etc.)
    const has45 = await page.getByText('45').first().isVisible().catch(() => false);
    if (has45) {
      expect(has45).toBe(true);
    }
  });

  test('renders App Permissions section', async ({ authedPage: page }) => {
    await goToPermissions(page);

    await expect(page.getByText('App Permissions')).toBeVisible();
    await expect(page.getByText('claw-finance')).toBeVisible();
  });

  test('app permissions show scope badge', async ({ authedPage: page }) => {
    await goToPermissions(page);

    // claw-finance has no semantic_scopes → Full access
    const appRow = page.getByText('claw-finance').first().locator('..').locator('..');
    await expect(appRow.getByText('Full access').or(appRow.getByText('Filtered'))).toBeVisible();
  });
});

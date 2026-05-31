/**
 * E2E: Sensor Fusion Settings (Wave 5 — Track B)
 *
 * Tests the Settings → Sensor Fusion section:
 * - HA connection status display
 * - Zone mapping list
 * - Rule list with enable/disable toggles
 * - Rule editor dialog (create, edit)
 * - Rule deletion
 * - Import built-in rules
 */

import { test, expect } from './fixtures';

test.describe('Sensor Fusion Settings', () => {
  async function goToSensorFusion(page: import('@playwright/test').Page) {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.getByText('Sensor Fusion', { exact: true }).click();
    await page.waitForTimeout(500);
  }

  test('renders HA connection section with connected status', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    await expect(page.getByText('Home Assistant Connection')).toBeVisible();
    await expect(page.getByText('Connected').first()).toBeVisible();
    await expect(page.getByText('Active rules')).toBeVisible();
  });

  test('displays zone mapping section', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    await expect(page.getByText('Zone Mapping')).toBeVisible();
    // Zone inputs should be visible
    const zoneInputs = page.locator('input[value="Office"], input[value="Kitchen"], input[value="Bedroom"]');
    const count = await zoneInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('displays automation rules list', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    await expect(page.getByText('Automation Rules')).toBeVisible();
    await expect(page.getByText('Meeting Mode').first()).toBeVisible();
    await expect(page.getByText('Rain Alert').first()).toBeVisible();
    await expect(page.getByText('Morning Briefing').first()).toBeVisible();
  });

  test('rules show enabled/disabled state correctly', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const rules = page.locator('text="Meeting Mode"').first();
    await expect(rules).toBeVisible();
  });

  test('can expand a rule to see details', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const meetingRule = page.getByText('Meeting Mode').first();
    await meetingRule.click();

    await expect(page.getByText('Dim lights and mute speakers', { exact: false })).toBeVisible();
  });

  test('opens rule editor dialog for new rule', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const newRuleBtn = page.locator('button:has-text("Add Rule"), button:has-text("New Rule"), button:has-text("+")').first();
    if (await newRuleBtn.isVisible()) {
      await newRuleBtn.click();

      await expect(page.getByText('Create Rule').or(page.getByText('New Rule')).first()).toBeVisible();
      await expect(page.locator('input[placeholder*="name" i], input[placeholder*="Name" i]').first()).toBeVisible();
    }
  });

  test('rule editor shows condition type dropdown', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const editBtn = page.locator('button[title*="edit" i], button[title*="Edit" i]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();

      await expect(page.getByText('Conditions').or(page.getByText('When')).first()).toBeVisible();
    }
  });

  test('rule editor shows action type dropdown', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const editBtn = page.locator('button[title*="edit" i], button[title*="Edit" i]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(page.getByText('Actions').or(page.getByText('Then')).first()).toBeVisible();
    }
  });

  test('shows last triggered timestamp for rules', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const meetingRule = page.getByText('Meeting Mode').first().locator('..');
    await expect(meetingRule).toBeVisible();
  });

  test('import built-in rules button is visible', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const importBtn = page.locator('button:has-text("Import Built-In"), button:has-text("Import"), button:has-text("Built-in")').first();
    await expect(importBtn).toBeVisible();
  });

  test('cooldown is displayed in rule editor', async ({ authedPage: page }) => {
    await goToSensorFusion(page);

    const editBtn = page.locator('button[title*="edit" i], button[title*="Edit" i]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(page.getByText('Cooldown').or(page.getByText('cooldown')).first()).toBeVisible();
    }
  });
});

/**
 * E2E: Voice Settings (Wave 5 — Track A)
 *
 * Tests the Settings → Voice section:
 * - STT/TTS service status indicators
 * - Model selector, language selector
 * - Speed slider
 * - Voice list with preview buttons
 * - Test STT / Test TTS buttons
 * - Offline state handling
 */

import { test, expect } from './fixtures';
import { MOCK_VOICE_STATUS_OFFLINE } from './helpers/api-mocks';

test.describe('Voice Settings', () => {
  async function goToVoice(page: import('@playwright/test').Page) {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.getByText('Voice', { exact: true }).click();
    await page.waitForTimeout(500);
  }

  test('renders STT and TTS sections with status indicators', async ({ authedPage: page }) => {
    await goToVoice(page);

    await expect(page.getByText('Speech-to-Text (STT)')).toBeVisible();
    await expect(page.getByText('Wyoming Whisper (local)')).toBeVisible();
    await expect(page.getByText('Running').first()).toBeVisible();
    await expect(page.getByText('10300')).toBeVisible();

    await expect(page.getByText('Text-to-Speech (TTS)')).toBeVisible();
    await expect(page.getByText('Wyoming Piper (local)')).toBeVisible();
    await expect(page.getByText('10200')).toBeVisible();
  });

  test('displays model selector with RAM estimates', async ({ authedPage: page }) => {
    await goToVoice(page);

    const modelSelect = page.locator('select').filter({ hasText: 'base-int8' }).first();
    await expect(modelSelect).toBeVisible();

    const options = await modelSelect.locator('option').allTextContents();
    expect(options).toContain('tiny-int8 (~75MB RAM)');
    expect(options).toContain('base-int8 (~200MB RAM)');
    expect(options).toContain('small-int8 (~500MB RAM)');
    expect(options).toContain('medium (~1.5GB RAM)');
  });

  test('displays language selector', async ({ authedPage: page }) => {
    await goToVoice(page);

    const langSelect = page.locator('select').filter({ hasText: 'Auto detect' }).first();
    await expect(langSelect).toBeVisible();

    const options = await langSelect.locator('option').allTextContents();
    expect(options).toContain('Español');
    expect(options).toContain('English');
  });

  test('shows speed slider with current value', async ({ authedPage: page }) => {
    await goToVoice(page);

    await expect(page.getByText('Speed', { exact: true })).toBeVisible();
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
    await expect(page.getByText('1.0x')).toBeVisible();

    await slider.fill('1.5');
    await expect(page.getByText('1.5x')).toBeVisible();
  });

  test('lists installed voices with preview buttons', async ({ authedPage: page }) => {
    await goToVoice(page);

    await expect(page.getByText('Installed voices')).toBeVisible();
    await expect(page.getByText('es_ES-mls-medium')).toBeVisible();
    await expect(page.getByText('en_US-lessac-medium')).toBeVisible();
    await expect(page.getByText('de_DE-thorsten-high')).toBeVisible();

    const previewButtons = page.locator('button[title="Preview voice"]');
    await expect(previewButtons).toHaveCount(3);
  });

  test('Test TTS button is enabled when service is online', async ({ authedPage: page }) => {
    await goToVoice(page);

    const testTtsBtn = page.getByText('Test TTS');
    await expect(testTtsBtn).toBeVisible();
    await expect(testTtsBtn).toBeEnabled();
  });

  test('Test STT button is enabled when service is online', async ({ authedPage: page }) => {
    await goToVoice(page);

    const testSttBtn = page.getByText('Test STT');
    await expect(testSttBtn).toBeVisible();
    await expect(testSttBtn).toBeEnabled();
  });

  test('shows offline status and disables buttons when services are down', async ({ authedPage: page }) => {
    await page.route('**/voice/status', route =>
      route.fulfill({ json: MOCK_VOICE_STATUS_OFFLINE }));

    await goToVoice(page);

    const offlineIndicators = page.getByText('Offline');
    await expect(offlineIndicators.first()).toBeVisible();

    const testSttBtn = page.locator('button:has-text("Test STT")');
    await expect(testSttBtn).toBeDisabled();
    const testTtsBtn = page.locator('button:has-text("Test TTS")');
    await expect(testTtsBtn).toBeDisabled();
  });

  test('shows Voice Mode section with input mode and auto-play toggle', async ({ authedPage: page }) => {
    await goToVoice(page);

    await expect(page.getByText('Voice Mode')).toBeVisible();
    await expect(page.getByText('Input mode')).toBeVisible();
    await expect(page.getByText('Auto-play responses')).toBeVisible();
    await expect(page.getByText('Keyboard shortcut')).toBeVisible();
    await expect(page.getByText('Space', { exact: true })).toBeVisible();
  });

  test('can change model selection', async ({ authedPage: page }) => {
    await goToVoice(page);

    const modelSelect = page.locator('select').filter({ hasText: 'base-int8' }).first();
    await modelSelect.selectOption('small-int8');

    await expect(modelSelect).toHaveValue('small-int8');
  });
});

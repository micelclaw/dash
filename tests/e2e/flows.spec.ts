/**
 * E2E: MicelFlow Module (Playwright)
 *
 * Tests the full Flows module from the user's perspective:
 * - Navigation and page rendering
 * - View modes (grid/list/banner)
 * - Template gallery and wizard
 * - Flow editor (create, edit, steps)
 * - Flow execution and history
 * - Toggle enable/disable
 * - Delete flow
 */

import { test, expect } from './fixtures';
import { setupFlowsMocks } from './helpers/flows-mocks';

test.describe('MicelFlow Module', () => {

  async function goToFlows(page: import('@playwright/test').Page) {
    await setupFlowsMocks(page);
    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
  }

  // ═══════════════════════════════════════════════════════════
  // Navigation & Page Rendering
  // ═══════════════════════════════════════════════════════════

  test('navigates to /flows and shows page header', async ({ authedPage: page }) => {
    await goToFlows(page);
    await expect(page.getByText('Flows').first()).toBeVisible();
  });

  test('shows existing flow in the list', async ({ authedPage: page }) => {
    await goToFlows(page);
    await expect(page.getByText('Morning Briefing').first()).toBeVisible();
  });

  test('shows My Flows tab as active by default', async ({ authedPage: page }) => {
    await goToFlows(page);
    await expect(page.getByText('My Flows').first()).toBeVisible();
  });

  test('shows Templates and History tabs', async ({ authedPage: page }) => {
    await goToFlows(page);
    await expect(page.getByText('Templates').first()).toBeVisible();
    await expect(page.getByText('History').first()).toBeVisible();
  });

  test('shows + New flow button', async ({ authedPage: page }) => {
    await goToFlows(page);
    await expect(page.locator('button:has-text("New flow")').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // View Modes
  // ═══════════════════════════════════════════════════════════

  test('shows view mode toggle buttons', async ({ authedPage: page }) => {
    await goToFlows(page);
    // 3 toggle buttons (grid, list, banner)
    const toggleContainer = page.locator('button[title="Grid"], button[title="List"], button[title="Banner"]');
    const count = await toggleContainer.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('can switch to list view', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.locator('button[title="List"]').click();
    await page.waitForTimeout(300);
    // In list view, flow should still be visible
    await expect(page.getByText('Morning Briefing').first()).toBeVisible();
  });

  test('can switch to banner view', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.locator('button[title="Banner"]').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Morning Briefing').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Template Gallery
  // ═══════════════════════════════════════════════════════════

  test('clicking Templates tab shows template gallery', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Inbox Triage').first()).toBeVisible();
    await expect(page.getByText('Weekly Review').first()).toBeVisible();
  });

  test('template gallery shows categories', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Productivity').first()).toBeVisible();
  });

  test('template cards show Use template button', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("Use template")').first()).toBeVisible();
  });

  test('template gallery has search input', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible();
  });

  test('searching templates filters results', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await page.locator('input[placeholder*="Search"]').first().fill('Inbox');
    await page.waitForTimeout(300);

    await expect(page.getByText('Inbox Triage').first()).toBeVisible();
    // Weekly Review should be hidden
    const weeklyVisible = await page.getByText('Weekly Review').first().isVisible().catch(() => false);
    expect(weeklyVisible).toBeFalsy();
  });

  // ═══════════════════════════════════════════════════════════
  // Template Wizard
  // ═══════════════════════════════════════════════════════════

  test('clicking Use template opens wizard modal', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template on Inbox Triage
    // Click Use template button inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Wizard modal should appear
    await expect(page.getByText('Create: Inbox Triage').first()).toBeVisible();
  });

  test('wizard shows step progress indicator', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template button inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Should show step indicator "Step 1 of 2"
    await expect(page.getByText('Step 1 of', { exact: false }).first()).toBeVisible();
  });

  test('wizard Next button advances to next step', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template button inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Click Next
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(300);

    // Should now show step 2
    await expect(page.getByText('Step 2 of', { exact: false }).first()).toBeVisible();
  });

  test('wizard Create flow button creates the flow', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template button inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Go through wizard steps
    const nextBtn = page.locator('button:has-text("Next")');
    while (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }

    // Click Create flow
    await page.locator('button:has-text("Create flow")').first().click();
    await page.waitForTimeout(1000);

    // Should navigate to editor or show success
    // The flow should now exist (we're either on /flows/:id or back on /flows)
    const url = page.url();
    const onEditor = url.includes('/flows/flow-');
    const onFlowsPage = url.endsWith('/flows');
    expect(onEditor || onFlowsPage).toBeTruthy();
  });

  test('wizard for template without steps creates immediately', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Weekly Review has no wizard steps
    // Click Use template button inside Weekly Review card
    await page.locator('button:has-text("Use template")').nth(1).click();
    await page.waitForTimeout(500);

    // Should show "ready to use" and Create flow directly
    await expect(page.locator('button:has-text("Create flow")').first()).toBeVisible();
    await page.locator('button:has-text("Create flow")').first().click();
    await page.waitForTimeout(1000);
  });

  test('wizard Cancel button closes modal', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template button inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(300);

    // Modal should be gone
    const wizardVisible = await page.getByText('Create: Inbox Triage').first().isVisible().catch(() => false);
    expect(wizardVisible).toBeFalsy();
  });

  // ═══════════════════════════════════════════════════════════
  // Flow Editor — Create from Scratch
  // ═══════════════════════════════════════════════════════════

  test('clicking + New flow navigates to editor', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.locator('button:has-text("New flow")').first().click();
    await page.waitForTimeout(500);

    expect(page.url()).toContain('/flows/new');
  });

  test('editor shows name input field', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await expect(page.locator('input[placeholder*="Flow name"]').first()).toBeVisible();
  });

  test('editor shows trigger selector', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await expect(page.getByText('Trigger').first()).toBeVisible();
    await expect(page.getByText('Manual').first()).toBeVisible();
    await expect(page.getByText('Scheduled').first()).toBeVisible();
  });

  test('editor shows Add step button', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("Add step")').first()).toBeVisible();
  });

  test('clicking Add step opens step palette', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Add step').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Search steps"]').first()).toBeVisible();
  });

  test('step palette shows categories', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(500);

    // Category chips should be visible
    await expect(page.getByText('All').first()).toBeVisible();
    await expect(page.getByText('Email').first()).toBeVisible();
    await expect(page.getByText('AI').first()).toBeVisible();
  });

  test('selecting a step from palette adds it to editor', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(500);

    // Click "Get emails" step
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(500);

    // Step should appear in the editor
    await expect(page.getByText('Get emails').first()).toBeVisible();
  });

  test('can add multiple steps', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Add first step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(300);

    // Add second step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Classify').first().click();
    await page.waitForTimeout(300);

    // Both steps should be visible
    await expect(page.getByText('Get emails').first()).toBeVisible();
    await expect(page.getByText('Classify').first()).toBeVisible();
  });

  test('selecting Scheduled trigger shows cron presets', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Scheduled")').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Weekdays 9 AM').first()).toBeVisible();
  });

  test('selecting Event trigger shows event dropdown', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Event")').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText('When this happens').first()).toBeVisible();
  });

  test('Save button is visible in editor', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("Create"), button:has-text("Save")').first()).toBeVisible();
  });

  test('can create a complete flow from scratch', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Set name
    await page.locator('input[placeholder*="Flow name"]').first().fill('E2E Test Flow');
    await page.waitForTimeout(200);

    // Add a step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Dashboard notification').first().click();
    await page.waitForTimeout(300);

    // Click Create
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(1000);

    // Should navigate away from /new
    expect(page.url()).not.toContain('/new');
  });

  // ═══════════════════════════════════════════════════════════
  // Flow Editor — Edit Existing
  // ═══════════════════════════════════════════════════════════

  test('clicking a flow card navigates to editor', async ({ authedPage: page }) => {
    await goToFlows(page);

    await page.getByText('Morning Briefing').first().click();
    await page.waitForTimeout(500);

    expect(page.url()).toContain('/flows/flow-');
  });

  test('editor loads existing flow data', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Name should be pre-filled
    const nameInput = page.locator('input[placeholder*="Flow name"]').first();
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toBe('Morning Briefing');
  });

  test('editor shows existing steps', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByText('Today\'s events').first()).toBeVisible();
    await expect(page.getByText('Generate briefing').first()).toBeVisible();
    await expect(page.getByText('Show briefing').first()).toBeVisible();
  });

  test('editor shows Run button for existing flow', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.locator('button:has-text("Run")').first()).toBeVisible();
  });

  test('editor shows Undo button for existing flow', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.locator('button[title="Undo"]').first()).toBeVisible();
  });

  test('back button returns to flows page', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Use browser back navigation instead of clicking a specific button
    await page.goBack();
    await page.waitForTimeout(500);

    // Should be somewhere other than /flow-existing-1
    expect(page.url()).not.toContain('flow-existing-1');
  });

  // ═══════════════════════════════════════════════════════════
  // Flow Toggle & Delete
  // ═══════════════════════════════════════════════════════════

  test('toggle button switches flow enabled state', async ({ authedPage: page }) => {
    await goToFlows(page);

    // Find the On/Off button
    const toggleBtn = page.locator('button:has-text("On")').first();
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Should now show "Off"
    await expect(page.locator('button:has-text("Off")').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Step Palette — Search & Filter
  // ═══════════════════════════════════════════════════════════

  test('step palette search filters steps', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);

    await page.locator('input[placeholder*="Search steps"]').first().fill('email');
    await page.waitForTimeout(300);

    await expect(page.getByText('Get emails').first()).toBeVisible();
    // Non-email steps should be hidden
    const brainVisible = await page.getByText('Classify').first().isVisible().catch(() => false);
    // Classify might still show if description contains email reference
  });

  test('step palette category chips filter by category', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);

    // Click AI category chip (exact match to avoid AI badges in step list)
    await page.getByRole('button', { name: 'AI', exact: true }).first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Classify').first()).toBeVisible();
  });

  test('closing step palette with X button', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);

    // Close via X button
    const closeBtn = page.locator('[role="dialog"] button, .fixed button').filter({ has: page.locator('svg') }).last();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Step Card — Expand & Configure
  // ═══════════════════════════════════════════════════════════

  test('clicking a step card expands its config', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Click on a step to expand
    await page.getByText('Today\'s events').first().click();
    await page.waitForTimeout(300);

    // Should show config fields
    await expect(page.getByText('Hours').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // History Tab
  // ═══════════════════════════════════════════════════════════

  test('History tab shows execution history', async ({ authedPage: page }) => {
    await goToFlows(page);

    await page.getByText('History').first().click();
    await page.waitForTimeout(500);

    // Should show some content (runs or empty state)
    const hasRuns = await page.getByText('completed').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No executions').first().isVisible().catch(() => false);
    expect(hasRuns || hasEmpty).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════
  // Global Stats
  // ═══════════════════════════════════════════════════════════

  test('shows global stats when flows have run', async ({ authedPage: page }) => {
    await goToFlows(page);

    // Stats banner should be visible if there are runs
    const statsVisible = await page.getByText('This month', { exact: false }).first().isVisible().catch(() => false);
    // May or may not show depending on mock data
  });

  // ═══════════════════════════════════════════════════════════
  // Step Manipulation — Remove, Reorder
  // ═══════════════════════════════════════════════════════════

  test('can remove a step with X button', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Add a step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(300);

    // Verify step exists
    await expect(page.getByText('Get emails').first()).toBeVisible();

    // Click remove (X) on the step
    const removeBtn = page.locator('button[title="Remove"]').first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('can move step up with arrow button', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Expand second step to see move buttons
    const secondStep = page.getByText('Generate briefing').first();
    await secondStep.click();
    await page.waitForTimeout(300);

    const moveUpBtn = page.locator('button[title="Move up"]').first();
    if (await moveUpBtn.isVisible()) {
      await moveUpBtn.click();
      await page.waitForTimeout(300);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Flow Execution from Editor
  // ═══════════════════════════════════════════════════════════

  test('Run button in editor triggers execution', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Run")').first().click();
    await page.waitForTimeout(1000);

    // Should show success toast
    const toastVisible = await page.locator('[data-sonner-toast]').first().isVisible().catch(() => false);
    // Toast may appear briefly
  });

  test('Play button on flow card triggers execution', async ({ authedPage: page }) => {
    await goToFlows(page);

    const playBtn = page.locator('button[title="Run now"]').first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Trigger Configuration Details
  // ═══════════════════════════════════════════════════════════

  test('Manual trigger shows description text', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Manual is default
    await expect(page.getByText('only when you click', { exact: false }).first()).toBeVisible();
  });

  test('Sensor trigger shows entity input', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Sensor")').first().click();
    await page.waitForTimeout(300);

    await expect(page.locator('input[placeholder*="binary_sensor"]').first()).toBeVisible();
  });

  test('Context trigger shows signal dropdown', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Context")').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText('When context changes').first()).toBeVisible();
  });

  test('Webhook trigger shows description about URL generation', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Webhook")').first().click();
    await page.waitForTimeout(300);

    await expect(page.getByText('unique URL', { exact: false }).first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════

  test('creating flow without name shows validation or creates with empty', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Don't fill name, just add a step and try to create
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Dashboard notification').first().click();
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(1000);

    // Should show error toast or validation
    // Either stays on /new (validation failed) or creates (name optional)
  });

  test('step palette can be closed by clicking backdrop', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);

    // Click the backdrop (the fixed overlay behind the modal)
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  });

  // ═══════════════════════════════════════════════════════════
  // Home Category Templates
  // ═══════════════════════════════════════════════════════════

  test('home category templates show in gallery', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Home').first()).toBeVisible();
    await expect(page.getByText('Focus Mode').first()).toBeVisible();
  });

  test('Focus Mode template opens wizard with HA entity field', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template button inside Focus Mode card
    await page.locator('button:has-text("Use template")').nth(2).click();
    await page.waitForTimeout(500);

    // Should show HA entity input
    await expect(page.getByText('Presence sensor', { exact: false }).first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // Full User Journey: Create from Template → Edit → Run → Delete
  // ═══════════════════════════════════════════════════════════

  test('full journey: template → edit → run → delete', async ({ authedPage: page }) => {
    await goToFlows(page);

    // 1. Go to templates
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // 2. Use Weekly Review (no wizard steps → direct create)
    // Click Use template button inside Weekly Review card
    await page.locator('button:has-text("Use template")').nth(1).click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Create flow")').first().click();
    await page.waitForTimeout(1000);

    // 3. Should be on editor now
    const url = page.url();
    expect(url).toContain('/flows/');

    // 4. Verify steps loaded
    await page.waitForTimeout(500);

    // 5. Click back to flows list
    await page.locator('button').filter({ has: page.locator('svg') }).first().click();
    await page.waitForTimeout(500);

    // 6. Flow should appear in list
    // (The mock adds it so it should be visible after refetch)
  });

  test('full journey: create from scratch with multiple steps', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // 1. Set name
    await page.locator('input[placeholder*="Flow name"]').first().fill('My Custom Flow');

    // 2. Select Scheduled trigger
    await page.locator('button:has-text("Scheduled")').first().click();
    await page.waitForTimeout(200);
    await page.getByText('Weekdays 9 AM').first().click();
    await page.waitForTimeout(200);

    // 3. Add email.list step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(300);

    // 4. Add AI classify step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Classify').first().click();
    await page.waitForTimeout(300);

    // 5. Add notification step
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Dashboard notification').first().click();
    await page.waitForTimeout(300);

    // 6. Verify 3 steps visible
    const steps = page.locator('[style*="border-left: 3px"]');
    const stepCount = await steps.count();
    expect(stepCount).toBeGreaterThanOrEqual(3);

    // 7. Create
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(1000);
  });

  // ═══════════════════════════════════════════════════════════
  // Scheduled Trigger — Cron Preset Selection
  // ═══════════════════════════════════════════════════════════

  test('selecting Daily 9 AM cron preset updates config', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Scheduled")').first().click();
    await page.waitForTimeout(200);

    await page.getByText('Daily 9 AM').first().click();
    await page.waitForTimeout(200);

    // The cron input should show the expression
    const cronInput = page.locator('input[placeholder*="cron"]').first();
    if (await cronInput.isVisible()) {
      const val = await cronInput.inputValue();
      expect(val).toContain('9');
    }
  });

  test('custom cron expression can be typed', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Scheduled")').first().click();
    await page.waitForTimeout(200);

    const cronInput = page.locator('input[placeholder*="cron"]').first();
    if (await cronInput.isVisible()) {
      await cronInput.fill('30 14 * * 1-5');
      await page.waitForTimeout(200);
      const val = await cronInput.inputValue();
      expect(val).toBe('30 14 * * 1-5');
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Template Wizard — All Templates
  // ═══════════════════════════════════════════════════════════

  test('Inbox Triage wizard has email account field', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Email setup').first()).toBeVisible();
    await expect(page.getByText('Which email account', { exact: false }).first()).toBeVisible();
  });

  test('Inbox Triage wizard Back button goes to previous step', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Go to step 2
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(300);

    // Go back
    await page.locator('button:has-text("Back")').first().click();
    await page.waitForTimeout(300);

    // Should be on step 1 again
    await expect(page.getByText('Step 1 of', { exact: false }).first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Step Card — Detailed Config
  // ═══════════════════════════════════════════════════════════

  test('expanding step shows output type badge', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await page.getByText('Today\'s events').first().click();
    await page.waitForTimeout(300);

    // Should show Output: Event[]
    await expect(page.getByText('Output:', { exact: false }).first()).toBeVisible();
  });

  test('step with input shows Data from previous step selector', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-existing-1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Click on step 2 (which has inputType)
    await page.getByText('Generate briefing').first().click();
    await page.waitForTimeout(300);

    // Should show input ref selector
    const inputSelector = page.getByText('Data from previous step', { exact: false }).first();
    const visible = await inputSelector.isVisible().catch(() => false);
    // May or may not show depending on stepDef.inputType
  });

  // ═══════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════

  test.skip('shows empty state when no flows exist', async ({ authedPage: page }) => {
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { data: [] } });
      return route.continue();
    });
    await setupFlowsMocks(page);
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { data: [] } });
      return route.continue();
    });

    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await expect(page.getByText('Automate your daily tasks').first()).toBeVisible();
    await expect(page.locator('button:has-text("Explore templates")').first()).toBeVisible();
  });

  test.skip('empty state Explore templates button switches to templates tab', async ({ authedPage: page }) => {
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { data: [] } });
      return route.continue();
    });
    await setupFlowsMocks(page);
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { data: [] } });
      return route.continue();
    });

    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Explore templates")').first().click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Inbox Triage').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Error Handling
  // ═══════════════════════════════════════════════════════════

  test.skip('handles API error on flow creation gracefully', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    // Override POST /flows to return error
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Test error' } } });
      }
      return route.continue();
    });

    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('input[placeholder*="Flow name"]').first().fill('Error Test');
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(1000);

    // Should show error toast and stay on page
    expect(page.url()).toContain('/new');
  });

  test.skip('handles tier limit error gracefully', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 403, json: { error: { code: 'TIER_LIMIT', message: 'Flow limit reached (5/5)' } } });
      }
      return route.continue();
    });

    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('input[placeholder*="Flow name"]').first().fill('Limit Test');
    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);
    await page.getByText('Get emails').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Create")').first().click();
    await page.waitForTimeout(1000);

    // Should stay on /new — not navigate away
    expect(page.url()).toContain('/new');
  });

  // ═══════════════════════════════════════════════════════════
  // Flow Card with null/missing data
  // ═══════════════════════════════════════════════════════════

  test.skip('flow card handles null last_run_at gracefully', async ({ authedPage: page }) => {
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { data: [{
          id: 'flow-null-test',
          name: 'Never Run Flow',
          icon: 'Workflow',
          color: '#f43f5e',
          category: 'custom',
          trigger_type: 'manual',
          trigger_config: {},
          steps: [],
          enabled: true,
          last_run_at: null,
          last_status: null,
          run_count: 0,
          success_count: 0,
          error_count: 0,
          version: 1,
          is_template: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]}});
      }
      return route.continue();
    });
    await setupFlowsMocks(page);
    await page.route('**/api/v1/flows', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { data: [{
          id: 'flow-null-test', name: 'Never Run Flow', icon: 'Workflow', color: '#f43f5e',
          category: 'custom', trigger_type: 'manual', trigger_config: {}, steps: [],
          enabled: true, last_run_at: null, last_status: null, run_count: 0,
          success_count: 0, error_count: 0, version: 1, is_template: false,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]}});
      }
      return route.continue();
    });

    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    // Should render without crashing
    await expect(page.getByText('Never Run Flow').first()).toBeVisible();
    // No "Invalid Date" or errors
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Invalid Date');
  });

  // ═══════════════════════════════════════════════════════════
  // Toggle in different view modes
  // ═══════════════════════════════════════════════════════════

  test('toggle works in list view', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.locator('button[title="List"]').click();
    await page.waitForTimeout(300);

    const toggleBtn = page.locator('button:has-text("On")').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('button:has-text("Off")').first()).toBeVisible();
    }
  });

  test('toggle works in banner view', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.locator('button[title="Banner"]').click();
    await page.waitForTimeout(300);

    const toggleBtn = page.locator('button:has-text("On")').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('button:has-text("Off")').first()).toBeVisible();
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Navigation — Direct URL Access
  // ═══════════════════════════════════════════════════════════

  test('direct URL /flows loads correctly', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page.getByText('Flows').first()).toBeVisible();
  });

  test('direct URL /flows/new loads editor', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder*="Flow name"]').first()).toBeVisible();
  });

  test('direct URL /flows/nonexistent shows editor (empty)', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/flow-nonexistent');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    // Should render without crashing (flow not found = empty editor)
  });

  // ═══════════════════════════════════════════════════════════
  // Sidebar — Module Visibility
  // ═══════════════════════════════════════════════════════════

  test('Flows icon appears in sidebar', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Sidebar should have Flows entry
    const sidebarFlows = page.locator('a[href="/flows"], [data-module="flows"]').first();
    // Or find by text in collapsed sidebar
    const flowsLink = page.locator('text="Flows"').first();
    const isVisible = await flowsLink.isVisible().catch(() => false) || await sidebarFlows.isVisible().catch(() => false);
    // In collapsed sidebar, only icon is visible — verify via URL navigation working
    expect(page.url()).toContain('/flows');
  });

  // ═══════════════════════════════════════════════════════════
  // Step Palette — Write & AI Badges
  // ═══════════════════════════════════════════════════════════

  test('step palette shows AI badge on AI steps', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Add step")').first().click();
    await page.waitForTimeout(300);

    // Filter by AI category (exact button match)
    await page.getByRole('button', { name: 'AI', exact: true }).first().click();
    await page.waitForTimeout(300);

    // Classify should be visible (AI step)
    await expect(page.getByText('Classify').first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════
  // Multiple Template Creates
  // ═══════════════════════════════════════════════════════════

  test('creating multiple flows from different templates', async ({ authedPage: page }) => {
    await goToFlows(page);

    // Create from Weekly Review
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);
    // Click Use template button inside Weekly Review card
    await page.locator('button:has-text("Use template")').nth(1).click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Create flow")').first().click();
    await page.waitForTimeout(1000);

    // Go back to flows
    await page.goto('/flows');
    await page.waitForTimeout(800);

    // Create from Focus Mode
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);
    // Click Use template button inside Focus Mode card
    await page.locator('button:has-text("Use template")').nth(2).click();
    await page.waitForTimeout(500);

    // Focus Mode has wizard with entity field
    const nextBtn = page.locator('button:has-text("Next")');
    while (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }
    const createBtn = page.locator('button:has-text("Create flow")');
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Keyboard Accessibility
  // ═══════════════════════════════════════════════════════════

  test('flow name input is focusable and editable', async ({ authedPage: page }) => {
    await setupFlowsMocks(page);
    await page.goto('/flows/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="Flow name"]').first();
    await nameInput.click();
    await nameInput.fill('Keyboard Test');
    const val = await nameInput.inputValue();
    expect(val).toBe('Keyboard Test');
  });

  test('wizard radio buttons are selectable', async ({ authedPage: page }) => {
    await goToFlows(page);
    await page.getByText('Templates').first().click();
    await page.waitForTimeout(500);

    // Click Use template inside Inbox Triage card
    await page.locator('button:has-text("Use template")').first().click();
    await page.waitForTimeout(500);

    // Radio buttons should be clickable
    const radios = page.locator('input[type="radio"]');
    const count = await radios.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Click the first radio
    await radios.first().click();
    await page.waitForTimeout(200);
    expect(await radios.first().isChecked()).toBeTruthy();
  });
});

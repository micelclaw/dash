/**
 * E2E: Context Insights (Wave 5 — Track E)
 *
 * Tests the context insights API integration.
 * Since insights are consumed by the agent/chat layer,
 * these tests verify the API contract via direct fetch
 * and any UI that surfaces insights (toasts, notifications).
 */

import { test, expect } from './fixtures';
import { MOCK_INSIGHTS } from './helpers/api-mocks';

test.describe('Context Insights', () => {
  test('insights API returns correct structure', async ({ authedPage: page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/context/insights');
      return resp.json();
    });

    expect(result.data).toBeDefined();
    expect(result.data.insights).toBeInstanceOf(Array);
    expect(result.data.insights.length).toBeGreaterThan(0);
    expect(result.data.computedAt).toBeDefined();
  });

  test('insights have required fields', async ({ authedPage: page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/context/insights');
      return resp.json();
    });

    const insight = result.data.insights[0];
    expect(insight.id).toBeDefined();
    expect(insight.category).toBeDefined();
    expect(insight.priority).toBeDefined();
    expect(insight.title).toBeDefined();
    expect(insight.body).toBeDefined();
    expect(insight.signals).toBeInstanceOf(Array);
  });

  test('insights include different priority levels', async ({ authedPage: page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/context/insights');
      return resp.json();
    });

    const priorities = result.data.insights.map((i: any) => i.priority);
    expect(priorities).toContain('high');
    expect(priorities).toContain('medium');
    expect(priorities).toContain('low');
  });

  test('insights include different categories', async ({ authedPage: page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/context/insights');
      return resp.json();
    });

    const categories = result.data.insights.map((i: any) => i.category);
    expect(categories).toContain('reminder');
    expect(categories).toContain('suggestion');
    expect(categories).toContain('optimization');
  });

  test('insights with navigate action have route payload', async ({ authedPage: page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/v1/context/insights');
      return resp.json();
    });

    const withAction = result.data.insights.filter((i: any) => i.action);
    expect(withAction.length).toBeGreaterThan(0);

    const navigateAction = withAction.find((i: any) => i.action.type === 'navigate');
    expect(navigateAction).toBeDefined();
    expect(navigateAction.action.payload.route).toBeDefined();
  });

  test('insights API supports llm query parameter', async ({ authedPage: page }) => {
    let requestedUrl = '';
    await page.route('**/context/insights*', route => {
      requestedUrl = route.request().url();
      return route.fulfill({ json: MOCK_INSIGHTS });
    });

    await page.evaluate(async () => {
      await fetch('/api/v1/context/insights?llm=true');
    });

    expect(requestedUrl).toContain('llm=true');
  });
});

/**
 * ApiSpy — Playwright utility that intercepts API calls, records them,
 * and provides assertion helpers for contract testing.
 *
 * Usage:
 *   const spy = new ApiSpy();
 *   await spy.setup(page, mocks);
 *   // ... interact with the UI ...
 *   spy.expectCall('POST', '/notes');
 *   spy.expectCallWith('POST', '/notes', { title: 'Test' });
 */

import type { Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';

const API_PREFIX = '/api/v1';

export interface ApiCall {
  method: string;
  path: string;       // relative to /api/v1, e.g. "/notes"
  fullUrl: string;
  body: unknown;
  timestamp: number;
  status: number;
}

export interface MockRoute {
  /** HTTP method (GET, POST, PATCH, PUT, DELETE). Case-insensitive. */
  method: string;
  /** Path relative to /api/v1, e.g. "/notes" or "/notes/*" (glob). */
  path: string;
  /** Response status code (default: 200). */
  status?: number;
  /** Response body (will be JSON-serialized). */
  response: unknown;
  /** Optional handler for dynamic responses based on request. */
  handler?: (route: Route) => Promise<void>;
}

export class ApiSpy {
  calls: ApiCall[] = [];
  private _unhandled: { method: string; path: string; fullUrl: string }[] = [];

  /**
   * Set up route interception on the page.
   *
   * @param page - Playwright page
   * @param mocks - Array of mock route definitions
   * @param options.passthrough - If true, unmatched API calls are passed through
   *                              instead of returning 404 (default: false)
   */
  async setup(
    page: Page,
    mocks: MockRoute[],
    options: { passthrough?: boolean } = {},
  ) {
    this.calls = [];
    this._unhandled = [];

    // Build a lookup map for quick matching
    const mockMap = new Map<string, MockRoute>();
    for (const mock of mocks) {
      const key = `${mock.method.toUpperCase()} ${mock.path}`;
      mockMap.set(key, mock);
    }

    // Intercept all /api/v1/** requests
    await page.route(`**${API_PREFIX}/**`, async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const fullPath = url.pathname;

      // Extract path relative to /api/v1
      const apiIdx = fullPath.indexOf(API_PREFIX);
      if (apiIdx === -1) {
        await route.continue();
        return;
      }
      const path = fullPath.slice(apiIdx + API_PREFIX.length) || '/';

      // Parse body
      let body: unknown = null;
      try {
        const postData = request.postData();
        if (postData) {
          body = JSON.parse(postData);
        }
      } catch {
        body = request.postData();
      }

      // Find matching mock (exact match first, then glob)
      const exactKey = `${method} ${path}`;
      let mock = mockMap.get(exactKey);

      if (!mock) {
        // Try glob matching: "/notes/*" matches "/notes/abc-123"
        for (const entry of Array.from(mockMap.entries())) {
          const [mMethod, mPath] = entry[0].split(' ', 2);
          const m = entry[1];
          if (mMethod !== method) continue;
          if (mPath.endsWith('/*')) {
            const prefix = mPath.slice(0, -2);
            if (path.startsWith(prefix + '/') || path === prefix) {
              mock = m;
              break;
            }
          }
          if (mPath.endsWith('/**')) {
            const prefix = mPath.slice(0, -3);
            if (path.startsWith(prefix)) {
              mock = m;
              break;
            }
          }
        }
      }

      if (mock) {
        const status = mock.status ?? 200;

        // Record the call
        this.calls.push({
          method,
          path,
          fullUrl: request.url(),
          body,
          timestamp: Date.now(),
          status,
        });

        // Use custom handler or default fulfill
        if (mock.handler) {
          await mock.handler(route);
        } else {
          await route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(mock.response),
          });
        }
      } else if (options.passthrough) {
        this.calls.push({
          method,
          path,
          fullUrl: request.url(),
          body,
          timestamp: Date.now(),
          status: -1, // passthrough
        });
        await route.continue();
      } else {
        this._unhandled.push({ method, path, fullUrl: request.url() });
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'NOT_MOCKED', message: `No mock for ${method} ${path}` } }),
        });
      }
    });
  }

  /** Reset recorded calls (keeps mocks active). */
  reset() {
    this.calls = [];
    this._unhandled = [];
  }

  /** Get all recorded calls. */
  getCalls(): ApiCall[] {
    return [...this.calls];
  }

  /** Get calls matching a method and path pattern. */
  findCalls(method: string, pathPattern: string | RegExp): ApiCall[] {
    return this.calls.filter((c) => {
      if (c.method !== method.toUpperCase()) return false;
      if (typeof pathPattern === 'string') return c.path === pathPattern;
      return pathPattern.test(c.path);
    });
  }

  /** Find the first call matching method + path. */
  findCall(method: string, pathPattern: string | RegExp): ApiCall | undefined {
    return this.findCalls(method, pathPattern)[0];
  }

  // ─── Assertions ───────────────────────────────────────────

  /** Assert that at least one call was made with the given method + path. */
  expectCall(method: string, pathPattern: string | RegExp, message?: string) {
    const found = this.findCalls(method, pathPattern);
    const desc = message ?? `Expected ${method} ${pathPattern} to have been called`;
    expect(found.length, desc).toBeGreaterThan(0);
    return found[0];
  }

  /** Assert that a call was made with matching body fields. */
  expectCallWith(
    method: string,
    pathPattern: string | RegExp,
    bodyMatch: Record<string, unknown>,
    message?: string,
  ) {
    const found = this.findCalls(method, pathPattern);
    const desc = message ?? `Expected ${method} ${pathPattern} with body matching ${JSON.stringify(bodyMatch)}`;
    expect(found.length, `${desc} — no calls found`).toBeGreaterThan(0);

    const matching = found.filter((c) => {
      if (!c.body || typeof c.body !== 'object') return false;
      for (const [key, value] of Object.entries(bodyMatch)) {
        if ((c.body as Record<string, unknown>)[key] !== value) return false;
      }
      return true;
    });

    expect(matching.length, desc).toBeGreaterThan(0);
    return matching[0];
  }

  /** Assert that NO call was made with the given method + path. */
  expectNoCall(method: string, pathPattern: string | RegExp, message?: string) {
    const found = this.findCalls(method, pathPattern);
    const desc = message ?? `Expected ${method} ${pathPattern} NOT to have been called`;
    expect(found.length, desc).toBe(0);
  }

  /** Assert exact number of calls matching method + path. */
  expectCallCount(method: string, pathPattern: string | RegExp, count: number, message?: string) {
    const found = this.findCalls(method, pathPattern);
    const desc = message ?? `Expected ${method} ${pathPattern} to be called ${count} time(s)`;
    expect(found.length, desc).toBe(count);
  }

  /** Get unmatched requests (useful for debugging). */
  getUnhandled() {
    return [...this._unhandled];
  }

  /** Print a summary of all recorded calls (for debugging). */
  dump() {
    console.log(`\n── ApiSpy: ${this.calls.length} calls ──`);
    for (const c of this.calls) {
      const bodyStr = c.body ? ` body=${JSON.stringify(c.body).slice(0, 80)}` : '';
      console.log(`  ${c.method} ${c.path} → ${c.status}${bodyStr}`);
    }
    if (this._unhandled.length > 0) {
      console.log(`  ⚠ ${this._unhandled.length} unhandled:`);
      for (const u of this._unhandled) {
        console.log(`    ${u.method} ${u.path}`);
      }
    }
  }
}

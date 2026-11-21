import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { MyApiKeysSection } from '/src/components/settings/sections/MyApiKeysSection.tsx';
  import { useAuthStore } from '/src/stores/auth.store.ts';
  import { useSettingsStore } from '/src/stores/settings.store.ts';
  useAuthStore.setState({ user: { id: 'fixture-user' }, isAuthenticated: true, sessionGeneration: 19, tokens: null });
  useSettingsStore.setState({ ownerSession: 'fixture-user:19', serverSettings: { general: { language: 'en' } } });
  window.setFixtureLocale = (language) => useSettingsStore.setState({ serverSettings: { general: { language } } });
  createRoot(document.getElementById('app')).render(React.createElement(MyApiKeysSection));
`;

test('API key metadata and locale are displayed without changing permissions', { timeout: 60_000 }, async () => {
  const vite = await createServer({
    root, configFile: false, logLevel: 'silent',
    plugins: [react(), { name: 's07-api-keys-fixture', resolveId(id) { if (id === '/s07-api-keys-fixture.jsx') return '\0s07-api-keys'; }, load(id) { if (id === '\0s07-api-keys') return source; } }],
    resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  const requests = [];
  const server = createHttpServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/fixture') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<div id="app"></div><script type="module" src="/s07-api-keys-fixture.jsx"></script>'); }
    if (pathname.startsWith('/api/')) {
      requests.push([req.method, pathname]);
      if (req.method !== 'GET' || pathname !== '/api/v1/api-keys/mine') { res.writeHead(500); return res.end('unexpected API request'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ data: [
        { id: 'synthetic-1', label: 'Save', key_prefix: 'fixture_only', scope: 'sync', last_used_at: '2026-11-16T12:00:00Z', created_at: '2026-11-01T00:00:00Z' },
        { id: 'synthetic-2', label: 'Second', key_prefix: 'fixture_two', scope: 'future-read-category', last_used_at: null, created_at: '2026-11-01T00:00:00Z' },
      ] }));
    }
    vite.middlewares(req, res, () => { if (!res.writableEnded) { res.writeHead(404); res.end('not found'); } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CLAW_CHROMIUM_PATH ? { executablePath: process.env.CLAW_CHROMIUM_PATH } : {}) });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const errors = [], outside = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== origin) { outside.push(new URL(route.request().url()).pathname); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/fixture`);
    await page.getByRole('heading', { name: 'My API Keys' }).waitFor();
    await page.getByText('fixture_only...', { exact: true }).waitFor();
    assert.equal(await page.getByText('Save', { exact: true }).count(), 1);
    assert.equal(await page.getByText('sync', { exact: true }).count(), 1);
    assert.equal(await page.getByText('fixture_two...', { exact: true }).count(), 1);
    assert.equal(await page.getByText('future-read-category', { exact: true }).count(), 1);
    await page.getByText(/^Last used:/).waitFor();
    assert.equal(requests.length, 1);
    await page.evaluate(() => window.setFixtureLocale('es'));
    await page.getByRole('heading', { name: 'Mis claves API' }).waitFor();
    await page.getByText(/^Último uso:/).waitFor();
    assert.equal(await page.getByText('Save', { exact: true }).count(), 1);
    assert.equal(await page.getByText('sync', { exact: true }).count(), 1);
    assert.equal(requests.length, 1, 'language change must not reload metadata');
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.animate-spin').length === 0);
    assert.deepEqual(requests, [['GET', '/api/v1/api-keys/mine'], ['GET', '/api/v1/api-keys/mine']]);
    assert.deepEqual(errors, []);
    assert.deepEqual(outside, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    await vite.close();
  }
});

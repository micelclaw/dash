import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = 'virtual:s07-workspace-locale';
const source = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { AgentWorkspaces } from '/src/modules/agents/AgentWorkspaces.tsx';
  import { useAuthStore } from '/src/stores/auth.store.ts';
  import { useSettingsStore } from '/src/stores/settings.store.ts';
  useAuthStore.setState({ user: { id: 'fixture-user' }, isAuthenticated: true, sessionGeneration: 1, tokens: null });
  const settings = { general: { language: 'en' } };
  useSettingsStore.setState({ ownerSession: 'fixture-user:1', serverSettings: settings });
  window.setFixtureLocale = (language) => useSettingsStore.setState({ serverSettings: { general: { language } } });
  const agents = [{ id: 'fixture-agent', name: 'fixture', display_name: 'Fixture agent' }];
  createRoot(document.getElementById('app')).render(React.createElement(AgentWorkspaces, { agents }));
`;

test('agent workspace locale changes keep open file and create dialog drafts', { timeout: 60_000 }, async () => {
  const calls = { list: 0, read: 0, writes: 0 };
  const vite = await createServer({
    root, configFile: false, logLevel: 'silent',
    plugins: [react(), {
      name: 's07-workspace-fixture',
      resolveId(id) { if (id === '/s07-workspace-fixture.jsx') return `\0${entry}`; },
      load(id) { if (id === `\0${entry}`) return source; },
    }],
    resolve: { alias: { '@': `${root}src` } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  const server = createHttpServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<div id="app"></div><script type="module" src="/s07-workspace-fixture.jsx"></script>');
    }
    const reply = (data) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data })); };
    if (pathname.startsWith('/api/v1/')) {
      if (req.method !== 'GET') { calls.writes++; res.writeHead(500); return res.end('unexpected write'); }
      if (pathname.endsWith('/workspace')) {
        calls.list++;
        return reply([
          { id: 'fixture-file', filename: 'private.md', filepath: 'private.md', is_directory: false, size_bytes: 12, updated_at: '2026-01-01T00:00:00Z', mime_type: 'text/markdown' },
          { id: 'fixture-identity', filename: 'IDENTITY.md', filepath: 'IDENTITY.md', is_directory: false, size_bytes: 12, updated_at: '2026-01-01T00:00:00Z', mime_type: 'text/markdown' },
        ]);
      }
      if (pathname.endsWith('/workspace-file')) { calls.read++; return reply({ content: 'fixture text' }); }
      res.writeHead(404); return res.end('unexpected fixture API');
    }
    vite.middlewares(req, res, () => { if (!res.writableEnded) { res.writeHead(404); res.end('not found'); } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CLAW_CHROMIUM_PATH ? { executablePath: process.env.CLAW_CHROMIUM_PATH } : {}) });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const external = [];
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== origin) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/fixture`);
    await page.getByText('Identity', { exact: true }).waitFor();
    await page.getByText('private.md', { exact: true }).click();
    await page.getByTitle('Edit', { exact: true }).click();
    const draft = page.locator('textarea');
    await draft.fill('Unsaved workspace draft');
    const before = { list: calls.list, read: calls.read };
    await page.getByRole('button', { name: 'New file' }).click();
    const filename = page.getByPlaceholder('memory/notes.md');
    await filename.fill('memory/draft.md');
    await page.evaluate(() => window.setFixtureLocale('es'));
    await page.getByText('Crear archivo en el espacio de trabajo').waitFor();
    await page.getByText('Identidad', { exact: true }).waitFor();
    await page.getByText('IDENTITY.md', { exact: true }).waitFor();
    assert.equal(await filename.inputValue(), 'memory/draft.md');
    assert.equal(await draft.inputValue(), 'Unsaved workspace draft');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByTitle('Vista previa', { exact: true }).waitFor();
    await page.evaluate(() => window.setFixtureLocale('en'));
    await page.getByTitle('Preview', { exact: true }).waitFor();
    assert.equal(await draft.inputValue(), 'Unsaved workspace draft');
    assert.deepEqual({ list: calls.list, read: calls.read }, before, 'locale must not reload the workspace or file');
    assert.equal(calls.writes, 0);
    assert.deepEqual(external, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    await vite.close();
  }
});

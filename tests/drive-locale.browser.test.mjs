import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = `
  import React, { useCallback, useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { DriveList } from '/src/modules/drive/DriveList.tsx';
  import { DriveToolbar } from '/src/modules/drive/DriveToolbar.tsx';
  import { useAuthStore } from '/src/stores/auth.store.ts';
  import { useSettingsStore } from '/src/stores/settings.store.ts';
  useAuthStore.setState({ user: { id: 'fixture-user' }, isAuthenticated: true, sessionGeneration: 1, tokens: null });
  useSettingsStore.setState({ ownerSession: 'fixture-user:1', serverSettings: { general: { language: 'en' } } });
  window.setFixtureLocale = (language) => useSettingsStore.setState({ serverSettings: { general: { language } } });
  window.fixtureActions = [];
  const file = { id: 'file-1', filename: 'Save', filepath: '/Save', is_directory: false, mime_type: 'text/plain', size_bytes: 4, updated_at: '2026-01-01T12:00:00Z', starred: true };
  function Fixture() {
    const [search, setSearch] = useState('');
    const [selection, setSelection] = useState(new Set(['file-1']));
    const onSearch = useCallback((value) => { window.fixtureActions.push(['search', value]); setSearch(value); }, []);
    return React.createElement(React.Fragment, null,
      React.createElement(DriveToolbar, { currentPath: '/', onNavigate() {}, search, onSearchChange: onSearch, onSearchAllFiles() {}, view: 'list', onViewChange() {}, onNewFolder() {}, onUpload() {} }),
      React.createElement(DriveList, { files: [file], loading: false, selectedFileId: 'file-1', selectedIds: selection, onItemClick() {}, onItemDoubleClick() {}, onToggleSelect(id) { setSelection((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; }); }, onToggleAll() {}, getContextMenuItems() { return []; }, onToggleStar() {} }),
    );
  }
  createRoot(document.getElementById('app')).render(React.createElement(Fixture));
`;

test('Drive language changes preserve search and file selection', { timeout: 60_000 }, async () => {
  const vite = await createServer({
    root, configFile: false, logLevel: 'silent',
    plugins: [react(), { name: 's07-drive-fixture', resolveId(id) { if (id === '/s07-drive-fixture.jsx') return '\0s07-drive'; }, load(id) { if (id === '\0s07-drive') return source; } }],
    resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  const server = createHttpServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/fixture') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<div id="app"></div><script type="module" src="/s07-drive-fixture.jsx"></script>'); }
    if (pathname.startsWith('/api/')) { res.writeHead(500); return res.end('unexpected API request'); }
    vite.middlewares(req, res, () => { if (!res.writableEnded) { res.writeHead(404); res.end('not found'); } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CLAW_CHROMIUM_PATH ? { executablePath: process.env.CLAW_CHROMIUM_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const unexpected = [], errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/fixture`);
    await page.getByRole('textbox', { name: 'Search files…' }).waitFor();
    const search = page.locator('input[type=text]');
    await search.fill('draft search');
    await page.waitForFunction(() => window.fixtureActions?.length === 1);
    assert.equal(await page.getByRole('checkbox', { name: 'Select Save' }).isChecked(), true);
    await page.getByRole('button', { name: 'Remove star' }).waitFor();
    await page.evaluate(() => window.setFixtureLocale('es'));
    await page.getByRole('textbox', { name: 'Buscar archivos…' }).waitFor();
    assert.equal(await search.inputValue(), 'draft search');
    assert.equal(await page.getByRole('checkbox', { name: 'Seleccionar Save' }).isChecked(), true);
    await page.getByRole('button', { name: 'Quitar destacado' }).waitFor();
    assert.equal(await page.getByText('Save', { exact: true }).count(), 1);
    await page.evaluate(() => window.setFixtureLocale('en'));
    await page.getByRole('textbox', { name: 'Search files…' }).waitFor();
    assert.equal(await search.inputValue(), 'draft search');
    assert.equal(await page.getByRole('checkbox', { name: 'Select Save' }).isChecked(), true);
    assert.deepEqual(await page.evaluate(() => window.fixtureActions), [['search', 'draft search']]);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    await vite.close();
  }
});

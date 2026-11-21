import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = 'virtual:s07-council-locale';
const source = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { NewMeetingModal } from '/src/modules/agents/council/NewMeetingModal.tsx';
  import { MeetingArchive } from '/src/modules/agents/council/MeetingArchive.tsx';
  import { useAuthStore } from '/src/stores/auth.store.ts';
  import { useSettingsStore } from '/src/stores/settings.store.ts';
  useAuthStore.setState({ user: { id: 'fixture-user' }, isAuthenticated: true, sessionGeneration: 1, tokens: null });
  useSettingsStore.setState({ ownerSession: 'fixture-user:1', serverSettings: { general: { language: 'en' } } });
  window.setFixtureLocale = (language) => useSettingsStore.setState({ serverSettings: { general: { language } } });
  window.fixtureSubmissions = 0;
  const agents = [
    { id: 'chief', name: 'chief', display_name: 'Save a copy', role: 'fixture role', is_chief: true },
    { id: 'member', name: 'member', display_name: 'Fixture member', role: 'fixture role', is_chief: false },
  ];
  const meetings = [
    { id: 'one', title: 'Fixture meeting one', status: 'scheduled', created_at: '2026-01-01T12:00:00Z', participants: [], messages: [{}], action_items: [{}, {}] },
    { id: 'two', title: 'Fixture meeting two', status: 'scheduled', created_at: '2026-01-02T12:00:00Z', participants: [], messages: [], action_items: [{}] },
  ];
  createRoot(document.getElementById('app')).render(React.createElement(React.Fragment, null,
    React.createElement(MeetingArchive, { meetings, onSelect() {} }),
    React.createElement(NewMeetingModal, {
      open: true, agents, onClose() {}, onCreated() {},
      async createMeeting() { window.fixtureSubmissions++; return null; },
    }),
  ));
`;

test('council meeting draft survives language changes', { timeout: 60_000 }, async () => {
  const vite = await createServer({
    root, configFile: false, logLevel: 'silent',
    plugins: [react(), { name: 's07-council-fixture', resolveId(id) { if (id === '/s07-council-fixture.jsx') return `\0${entry}`; }, load(id) { if (id === `\0${entry}`) return source; } }],
    resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  const server = createHttpServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (pathname === '/fixture') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<div id="app"></div><script type="module" src="/s07-council-fixture.jsx"></script>'); }
    if (pathname.startsWith('/api/')) { res.writeHead(500); return res.end('unexpected API request'); }
    vite.middlewares(req, res, () => { if (!res.writableEnded) { res.writeHead(404); res.end('not found'); } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CLAW_CHROMIUM_PATH ? { executablePath: process.env.CLAW_CHROMIUM_PATH } : {}) });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const unexpected = [];
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/fixture`);
    for (const text of ['1 message', '2 action items', '0 messages', '1 action item']) await page.getByText(text, { exact: true }).waitFor();
    const topic = page.locator('input[type=text]');
    const description = page.locator('textarea');
    await topic.fill('Unsaved council topic');
    await description.fill('Private draft stays literal');
    await page.locator('label').filter({ hasText: 'Fixture member' }).getByRole('checkbox').check();
    const advanced = page.getByRole('button', { name: /Advanced options/ });
    assert.match(await advanced.textContent(), /3 rounds/);
    await advanced.click();
    await page.locator('select').selectOption('5');
    assert.match(await advanced.textContent(), /5 rounds/);
    await page.evaluate(() => window.setFixtureLocale('es'));
    await page.getByText('Programar reunión del consejo', { exact: true }).waitFor();
    for (const text of ['1 mensaje', '2 tareas', '0 mensajes', '1 tarea']) await page.getByText(text, { exact: true }).waitFor();
    assert.match(await page.getByRole('button', { name: /Opciones avanzadas/ }).textContent(), /5 rondas/);
    assert.equal(await topic.inputValue(), 'Unsaved council topic');
    assert.equal(await description.inputValue(), 'Private draft stays literal');
    assert.equal(await page.locator('label').filter({ hasText: 'Fixture member' }).getByRole('checkbox').isChecked(), true);
    assert.equal(await page.locator('select').inputValue(), '5');
    assert.equal(await page.getByText('Save a copy', { exact: true }).count() > 0, true);
    await page.evaluate(() => window.setFixtureLocale('en'));
    await page.getByText('Schedule council meeting', { exact: true }).waitFor();
    assert.equal(await topic.inputValue(), 'Unsaved council topic');
    assert.equal(await description.inputValue(), 'Private draft stays literal');
    assert.equal(await page.locator('select').inputValue(), '5');
    assert.equal(await page.evaluate(() => window.fixtureSubmissions), 0);
    assert.deepEqual(unexpected, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    await vite.close();
  }
});

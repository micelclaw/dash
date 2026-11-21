import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

// Portable sibling-repo source lookup; no author paths, credentials or installs.
const DASH = fileURLToPath(new URL('../../../../', import.meta.url));
const CORE = path.join(path.dirname(DASH), 'micelclaw-os/core');
const { build } = await import(pathToFileURL(path.join(CORE, 'node_modules/esbuild/lib/main.js')).href);
const { chromium, expect } = await import(pathToFileURL(path.join(DASH, 'node_modules/@playwright/test/index.mjs')).href);
const scratch = await mkdtemp(path.join(tmpdir(), 'micelclaw-decision-refresh-'));
const target = path.join(DASH, 'src/modules/gateway/tabs/ModelsTab.tsx');
let browser, bundle;
const baseCatalog = () => ({ models: [{ provider: 'onnx', id: 'initial', name: 'Initial' }, { provider: 'onnx', id: 'draft', name: 'Draft' }],
  default_model: 'onnx/initial', providers: [{ id: 'onnx', model_count: 2, active: true, configured: true }], typesafe_mode: 'jev-hosted', kev_status: null,
  assistance: { configured: false, recent_exchanges_max: 2, timeout_ms: 500, may_send_context_to_provider: true, grants_actions: false } });
const catalog = name => ({ ...baseCatalog(), models: [...baseCatalog().models, { provider: 'onnx', id: name, name }], default_model: `onnx/${name}` });
before(async () => {
  const entry = path.join(scratch, 'entry.tsx');
  await writeFile(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';import {ModelsTab} from ${JSON.stringify(target)};createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/?view=decision']}><ModelsTab/></MemoryRouter>);`);
  const stubs = {
    '@/stores/gateway.store': `const noop=async()=>{};const state={models:[{id:'fixture/model'}],catalog:[],catalogProviders:[],installableProviders:[],catalogOpenclawVersion:'2026.10.7',modelsLoading:false,catalogLoading:false,modelsError:null,catalogError:null,providersOverview:null,providersOverviewLoading:false,catalogWarm:true,modelTests:{},testingModels:new Set(),queuedRemovals:[],inflightRemovals:[],fetchModels:noop,fetchCatalog:noop,fetchProvidersOverview:noop,hydrateModelTests:noop};export const useGatewayStore=()=>state;`,
    '@/stores/apps.store': `export const useAppsStore=selector=>selector({setRestartRequired(){}});`,
    '@/stores/auth.store': `export const useAuthStore=selector=>selector({user:{id:window.__ROLE==='owner'?'f47ac10b-58cc-4372-a567-0e02b2c3d479':'dd4d75fb-0000-4000-8000-000000000026',role:window.__ROLE}});`,
    '@/hooks/use-media-query': `export const useIsMobile=()=>false;`,
    '@/hooks/use-websocket': `export const useWebSocket=()=>null;`,
    '@/services/api': `export const api={async get(p){if(p!=='/gateway/decision-models')throw Error('Unexpected fixture API');const r=await fetch('/fixture/catalog');if(!r.ok)throw Error('Synthetic catalog unavailable');return r.json();},async patch(p,body){if(p!=='/gateway/decision-models/default')throw Error('Unexpected write');return(await fetch('/fixture/default',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();},async post(){throw Error('Unexpected write');}};`,
    '@/services/agents-admin.service': `export const listManagedAgents=async()=>[];export const notifyDecisionModelsChanged=()=>{};`,
    '@/services/gateway.service': `export const getProvidersConfig=async()=>({providers:{}});export const discoverProviderModels=async()=>({models:[]});export const installOfficialProvider=async()=>{};export const migrateLegacyProvider=async()=>({});export const deleteProvider=async()=>{};`,
    '@/components/shared/EmptyState': `export const EmptyState=()=>null;`,
    '@/components/shared/ConfirmDialog': `export const ConfirmDialog=()=>null;`,
    sonner: `export const toast={success(){},error(){}};`,
  };
  await build({ entryPoints: [entry], outfile: path.join(scratch, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    absWorkingDir: DASH, nodePaths: [path.join(DASH, 'node_modules')], alias: { '@': path.join(DASH, 'src') }, logLevel: 'silent',
    plugins: [{ name: 'explicit-api-and-unused-surface-fixtures', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (stubs[args.path]) return { path: args.path, namespace: 'fixture' };
        if (args.importer === target && args.path.startsWith('../components/') && !args.path.endsWith('/DecisionModelsView')) return { path: args.path, namespace: 'unused' };
        if (args.importer === target && args.path.startsWith('./models/') && !['ModelsHeader', 'constants', 'types'].includes(path.basename(args.path))) return { path: args.path, namespace: 'unused' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
      builder.onLoad({ filter: /.*/, namespace: 'unused' }, args => ({ contents: path.basename(args.path) === 'useModelMutations'
        ? 'export const useModelMutations=()=>({});'
        : `export const ${path.basename(args.path)}=()=>null;export const providerTypeForId=()=>null;`, loader: 'js' }));
    } }],
  });
  bundle = await readFile(path.join(scratch, 'bundle.js'));
  browser = await chromium.launch({ channel: process.env.MICELCLAW_TEST_BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await rm(scratch, { recursive: true, force: true }); });

async function fixture(t, role = 'owner') {
  const state = { reads: 0, writes: 0, expectedWrites: 0, held: [], hold: false, status: 200, next: baseCatalog(), outside: [], errors: [] };
  const server = createServer((req, res) => {
    if (req.method === 'PATCH' && req.url === '/fixture/default') {
      state.writes++; let body = ''; req.on('data', bytes => { body += bytes; }); req.on('end', () => {
        state.next.default_model = JSON.parse(body).model;
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: { default_model: state.next.default_model, affected_agents: [] } }));
      }); return;
    }
    if (req.method !== 'GET') { state.writes++; res.writeHead(405).end(); return; }
    if (req.url === '/bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle); return; }
    if (req.url === '/fixture/catalog') {
      state.reads++; const captured = { res, data: structuredClone(state.next), status: state.status };
      if (state.hold) state.held.push(captured); else send(captured); return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext(); await context.addInitScript(role => { window.__ROLE = role; }, role);
  await context.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); state.outside.push(route.request().url()); return route.abort(); });
  const page = await context.newPage(); page.on('pageerror', error => state.errors.push(error.message));
  t.after(async () => { for (const held of state.held) if (!held.res.writableEnded) held.res.writeHead(503).end(); await context.close(); await new Promise(resolve => server.close(resolve)); assert.deepEqual(state.outside, []); assert.deepEqual(state.errors, []); assert.equal(state.writes, state.expectedWrites); });
  await page.goto(origin); await expect(page.getByText('Modelo de decisión predeterminado', { exact: true })).toBeVisible();
  const refresh = page.locator('button:has(svg.lucide-refresh-cw)'); await expect(refresh).toHaveCount(1);
  return { state, page, refresh };
}
function send({ res, data, status }) { res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ data })); }
async function readCount(state, count) { await expect.poll(() => state.reads, { timeout: 1500 }).toBe(count); }

test('Paco user click on real ModelsHeader refresh issues a new catalog read without changing permissions', async t => {
  const f = await fixture(t, 'user'); f.state.next = catalog('fresh'); await f.refresh.click(); await readCount(f.state, 2);
  await expect(f.page.locator('code').filter({ hasText: /^fresh$/ })).toBeVisible(); await expect(f.page.locator('select').first()).toBeDisabled();
});
test('refresh keeps the live configuration form and unsaved model/assistance selections during loading and completion', async t => {
  const f = await fixture(t); await f.page.locator('select').first().selectOption('onnx/draft'); await f.page.getByLabel('Activada para agentes elegibles').check();
  const handle = await f.page.locator('select').first().elementHandle();
  f.state.hold = true; f.state.next = catalog('fresh'); await f.refresh.click(); await readCount(f.state, 2);
  await expect(f.page.getByRole('status')).toContainText('Actualizando'); await expect(f.page.locator('select').first()).toHaveValue('onnx/draft');
  assert.equal(await handle.evaluate(el => el.isConnected), true); send(f.state.held.shift());
  await expect(f.page.locator('code').filter({ hasText: /^fresh$/ })).toBeVisible(); await expect(f.page.locator('select').first()).toHaveValue('onnx/draft'); await expect(f.page.getByLabel('Activada para agentes elegibles')).toBeChecked();
});
test('refresh failure preserves observed catalog and draft; visible retry performs another read', async t => {
  const f = await fixture(t); await f.page.locator('select').first().selectOption('onnx/draft'); f.state.status = 503;
  await f.refresh.click(); await readCount(f.state, 2); await expect(f.page.getByRole('alert')).toContainText('Synthetic catalog unavailable');
  await expect(f.page.locator('select').first()).toHaveValue('onnx/draft');
  f.state.status = 200; f.state.next = catalog('recovered'); await f.page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await readCount(f.state, 3);
  await expect(f.page.locator('code').filter({ hasText: /^recovered$/ })).toBeVisible(); await expect(f.page.locator('select').first()).toHaveValue('onnx/draft');
});
test('a stale delayed refresh cannot overwrite the newer catalog result', async t => {
  const f = await fixture(t); f.state.hold = true; f.state.next = catalog('stale'); await f.refresh.click(); await readCount(f.state, 2);
  f.state.next = catalog('newest'); await f.refresh.click(); await readCount(f.state, 3);
  send(f.state.held[1]); await expect(f.page.locator('code').filter({ hasText: /^newest$/ })).toBeVisible();
  send(f.state.held[0]); await f.page.waitForTimeout(75); await expect(f.page.locator('code').filter({ hasText: /^newest$/ })).toBeVisible(); await expect(f.page.locator('code').filter({ hasText: /^stale$/ })).toHaveCount(0);
});
test('saving while a refresh is pending does not let its older response undo the selected value', async t => {
  const f = await fixture(t); f.state.hold = true; await f.refresh.click(); await readCount(f.state, 2);
  await f.page.locator('select').first().selectOption('onnx/draft'); f.state.expectedWrites = 1;
  await f.page.getByRole('button', { name: 'Guardar', exact: true }).click(); await expect.poll(() => f.state.writes).toBe(1);
  await expect(f.page.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
  send(f.state.held.shift()); await expect(f.page.getByRole('status')).toHaveCount(0);
  await expect(f.page.locator('select').first()).toHaveValue('onnx/draft'); assert.equal(f.state.next.default_model, 'onnx/draft');
});

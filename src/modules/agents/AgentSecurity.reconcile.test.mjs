import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const dash = path.resolve(import.meta.dirname, '../../..');
const require = createRequire(path.join(dash, 'package.json'));
const { build } = createRequire(path.join(path.dirname(dash), 'micelclaw-os/core/package.json'))('esbuild');
const { chromium, expect } = require('@playwright/test');
const scratch = await mkdtemp(path.join(tmpdir(), 'agent-reconcile-'));
let browser;
let bundle;

const stubs = {
  '@/services/api': `export class ApiError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }`,
  '@/stores/auth.store': `export const useAuthStore = selector => selector({ user: { id: 'paco-fixture', role: 'user' } });`,
  '@/hooks/useVisibleSecurityPolling': `export const useVisibleSecurityPolling = () => {};`,
  './AgentSandboxConfig': `export const AgentSandboxConfig = () => null;`,
  './security/SecurityUi': `import React from 'react';
    export const SecurityHelpProvider = ({children}) => <>{children}</>;
    export const SecurityHelp = () => null;
    export const SecuritySection = ({title,children,hidden}) => <section hidden={hidden}><h2>{title}</h2>{children}</section>;
    export const SecurityFacts = ({rows}) => <dl>{rows.map(([name,value],i) => <div key={i}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
    export const SecurityButton = ({children,variant,...props}) => <button type="button" {...props}>{children}</button>;
    export const StatusDot = () => null;
    export const StatusText = ({status}) => <span>{status.text}</span>;
    export const InlineReview = ({title,children,actions,onCancel}) => <div><h3>{title}</h3>{children}<button type="button" onClick={onCancel}>Cancelar</button>{actions}</div>;
    export const RadioChoice = ({label,checked,onChange,disabled}) => <label><input type="radio" checked={checked} disabled={disabled} onChange={onChange}/>{label}</label>;
    export const focusSecurity = () => {};
    export const settingClass = '';
    export const inputClass = '';`,
  sonner: `export const toast = { success: text => window.__F.toasts.push(['success',text]), error: text => window.__F.toasts.push(['error',text]) };`,
  '@/services/security-policy.service': `import { ApiError } from '@/services/api';
    const f = () => window.__F;
    const row = id => f().agents[id];
    export async function getAgentSecurity(id) {
      f().policyReads++;
      if (f().holdRead === id) return new Promise(resolve => { f().releaseReads.push(() => resolve(security(id))); });
      return security(id);
    }
    function security(id) { const a = row(id); return {
      agent: { id, owner_role: 'user' },
      desired: { mode: a.mode, revision: a.revision, applied_revision: a.applied ? a.revision : null,
        state: a.applied ? 'in_sync' : 'reconciliation_required', profile_id: 'profile-1', unattended_fallback: 'deny_and_notify' },
      effective: { status: a.applied ? 'in_sync' : 'reconciliation_required', observed_at: new Date().toISOString() },
      inherited: { owner_max_user_mode: 'auto', server_default_mode: 'auto', profile: { id: 'profile-1', name: 'Auto', version: 1 } },
      rules: { profile: [], overrides: [] }, break_glass: [], adapters: [], recovery: null,
    }; }
    export async function getAgentSecurityRuntime(id) { const a = row(id); return {
      managed: true, desired_revision: a.revision, requested_mode: a.mode, effective_mode: a.applied ? a.mode : 'deny',
      drift: { state: a.applied ? 'in_sync' : 'drifted', recovery: a.applied ? 'none' : 'reconcile' },
      guard: { health: 'healthy', loaded: true, active_lease_ids: [] }, adapters: [], layers: [],
    }; }
    export const listCommandProfiles = async () => [{ id: 'profile-1', name: 'Auto', status: 'published', published_version: 1, max_exec_mode: 'auto', extension_policy: 'block_only', updated_at: '2026-11-17' }];
    export const listProtectedCategories = async () => [];
    export const getSecuritySettings = async () => ({ max_user_exec_mode: 'auto', break_glass_max_minutes: 60, allow_admin_break_glass: false });
    export async function reconcileAgentSecurity(id, expectation) {
      f().writes.push({ id, expectation });
      f().beforeWrite?.(id);
      const a = row(id);
      if (f().failure || expectation?.expected_revision !== a.revision || expectation?.expected_mode !== a.mode || a.leaseOpen)
        throw new ApiError('La política guardada cambió o existe un acceso temporal.', 409, 'AGENT_SECURITY_POLICY_CHANGED');
      if (f().apply) a.applied = true;
      return { requested: true };
    }
    export const previewAgentSecurity = async () => { throw Error('not expected'); };
    export const updateAgentSecurity = async () => { throw Error('not expected'); };
    export const addAgentSecurityRule = async () => { throw Error('not expected'); };
    export const revokeAgentSecurityRule = async () => { throw Error('not expected'); };
    export const revokeAgentBreakGlass = async () => { throw Error('not expected'); };
    export const requestAgentBreakGlass = async () => { throw Error('not expected'); };`,
};

before(async () => {
  const entry = path.join(scratch, 'entry.tsx');
  await writeFile(entry, `import React,{StrictMode,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {AgentSecurity} from ${JSON.stringify(path.join(dash, 'src/modules/agents/AgentSecurity.tsx'))};
    function App(){const [agent,setAgent]=useState('agent-a');window.changeAgent=setAgent;
      return <AgentSecurity agentId={agent} agentName={agent} showSandbox={false}/>;}
    createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);`);
  const built = await build({ entryPoints: [entry], absWorkingDir: dash, nodePaths: [path.join(dash, 'node_modules')],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/|^\.\/AgentSandboxConfig$|^\.\/security\/SecurityUi$|^sonner$/ }, arg => {
        const key = arg.path;
        return stubs[key] ? { path: key, namespace: 'stub' } : undefined;
      });
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, arg => ({ contents: stubs[arg.path], loader: 'tsx', resolveDir: path.join(dash, 'src/modules/agents') }));
    } }],
  });
  bundle = built.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, ...(existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await rm(scratch, { recursive: true, force: true }); });

async function fixture(t, options = {}) {
  const context = await browser.newContext();
  await context.route('**/*', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.evaluate(value => { window.__F = {
    agents: { 'agent-a': { mode: 'ask', revision: 2, applied: false, leaseOpen: false }, 'agent-b': { mode: 'auto', revision: 7, applied: false, leaseOpen: false } },
    writes: [], toasts: [], policyReads: 0, releaseReads: [], holdRead: null, apply: false, failure: false, ...value,
  }; }, options);
  await page.addScriptTag({ content: bundle });
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await expect(page.getByRole('button', { name: 'Volver a aplicar lo guardado' })).toBeEnabled();
  return page;
}
async function openReview(page) {
  await page.getByRole('button', { name: 'Volver a aplicar lo guardado' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar reaplicación' })).toBeVisible();
}

test('reconcile sends the saved revision and mode, never a pending draft, and keeps readback pending', async t => {
  const page = await fixture(t);
  await page.getByRole('radio', { name: /auto · Revisión automática/ }).check();
  await openReview(page);
  await page.getByRole('button', { name: 'Confirmar reaplicación' }).click();
  await expect.poll(() => page.evaluate(() => window.__F.writes.length)).toBe(1);
  assert.deepEqual(await page.evaluate(() => window.__F.writes), [{ id: 'agent-a', expectation: { expected_revision: 2, expected_mode: 'ask' } }]);
  await expect.poll(() => page.evaluate(() => window.__F.policyReads)).toBeGreaterThan(1);
  await expect(page.getByText(/Aplicación pendiente o sin comprobar|No coincide/).first()).toBeVisible();
  await expect(page.getByText(/Aplicados ·/)).toHaveCount(0);
});

test('a matching readback can show applied state only after the controlled service applies it', async t => {
  const page = await fixture(t, { apply: true });
  await openReview(page);
  await page.getByRole('button', { name: 'Confirmar reaplicación' }).click();
  await expect.poll(() => page.evaluate(() => window.__F.policyReads)).toBeGreaterThan(1);
  await expect(page.getByText(/Aplicados · Consultar/).first()).toBeVisible();
});

test('server revision or mode change after confirmation rejects the captured expectation without success', async t => {
  for (const change of [{ revision: 3 }, { mode: 'auto' }, { leaseOpen: true }]) {
    const page = await fixture(t, { beforeWrite: undefined });
    await openReview(page);
    await page.evaluate(value => { window.__F.beforeWrite = id => Object.assign(window.__F.agents[id], value); }, change);
    await page.getByRole('button', { name: 'Confirmar reaplicación' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /política guardada cambió|acceso temporal/ }).first()).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.__F.writes[0].expectation), { expected_revision: 2, expected_mode: 'ask' });
    assert.equal(await page.evaluate(() => window.__F.toasts.some(([kind]) => kind === 'success')), false);
    await page.close();
  }
});

test('a refreshed saved mode invalidates the old confirmation before sending', async t => {
  const page = await fixture(t);
  await openReview(page);
  await page.evaluate(() => { window.__F.agents['agent-a'].mode = 'auto'; });
  await page.getByRole('button', { name: 'Comprobar ahora' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar reaplicación' })).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.__F.writes.length), 0);
});

test('agent change discards the old confirmation and delayed old-agent data', async t => {
  const page = await fixture(t);
  await openReview(page);
  await page.evaluate(() => { window.__F.holdRead = 'agent-a'; });
  await page.getByRole('button', { name: 'Comprobar ahora' }).click();
  await expect.poll(() => page.evaluate(() => window.__F.releaseReads.length)).toBe(1);
  await page.evaluate(() => { window.changeAgent('agent-b'); });
  await expect(page.locator('[data-agent-id="agent-b"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Confirmar reaplicación' })).toHaveCount(0);
  await page.evaluate(() => { for (const release of window.__F.releaseReads.splice(0)) release(); });
  await expect(page.getByRole('button', { name: 'Volver a aplicar lo guardado' })).toBeEnabled();
  assert.equal(await page.evaluate(() => window.__F.writes.length), 0);
  await openReview(page);
  await page.getByRole('button', { name: 'Confirmar reaplicación' }).click();
  await expect.poll(() => page.evaluate(() => window.__F.writes.length)).toBe(1);
  assert.deepEqual(await page.evaluate(() => window.__F.writes[0]), { id: 'agent-b', expectation: { expected_revision: 7, expected_mode: 'auto' } });
});

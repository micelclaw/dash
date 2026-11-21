import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [req.resolve('vite')] }));
const built = await esbuild.build({
  stdin: { contents: `export {activateUiPreferences,useUiPreferencesStore} from './src/stores/ui-preferences.store';export {useSidebarStore} from './src/stores/sidebar.store';export {useCalendarUiStore} from './src/stores/calendar-ui.store';export {useDriveStore} from './src/stores/drive.store';export {readLegacyUiPreferences,DEFAULT_UI_PREFERENCES} from './src/services/ui-preferences.service';export {ApiError} from '@/services/api';`, resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'Fixture', platform: 'browser', tsconfig: path.join(root, 'tsconfig.app.json'),
  plugins: [{ name: 'preference-api-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export class ApiError extends Error{constructor(code,message){super(message);this.code=code}};export const api={get:(...args)=>globalThis.fixtureApi.get(...args),patch:(...args)=>globalThis.fixtureApi.patch(...args),post:(...args)=>globalThis.fixtureApi.post(...args)};` }));
  } }],
});
const plain = value => JSON.parse(JSON.stringify(value));
function environment(initialStorage = {}) {
  const writes = [], storage = new Map(Object.entries(initialStorage)), timers = new Map();
  let next = 0, user = 'a', handler, patchHandler, postHandler;
  const context = vm.createContext({ console, structuredClone, setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id), setInterval: () => ++next, clearInterval: () => {}, window: { addEventListener() {}, removeEventListener() {} }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes.push({ key, value }); storage.set(key, value); } } });
  const rows = new Map(), calls = [];
  function current() { if (!rows.has(user)) rows.set(user, { preferences: plain(context.Fixture.DEFAULT_UI_PREFERENCES), revision: `revision-${user}`, legacy_decision: 'pending' }); return rows.get(user); }
  context.fixtureApi = {
    get: async path => { calls.push({ method: 'GET', user, path }); return handler ? handler(user, path) : { data: plain(current()) }; },
    patch: async (path, body) => { calls.push({ method: 'PATCH', user, path, body: plain(body) }); if (patchHandler) return patchHandler(user, path, plain(body)); const row = current(); row.preferences = { ...row.preferences, ...plain(body.patch) }; row.revision += '+'; return { data: plain(row) }; },
    post: async (path, body) => { calls.push({ method: 'POST', user, path, body: plain(body) }); if (postHandler) return postHandler(user, path, plain(body)); const row = current(); if (body.decision === 'adopt') row.preferences = { ...row.preferences, ...plain(body.preferences) }; row.legacy_decision = body.decision === 'adopt' ? 'adopted' : 'dismissed'; return { data: plain(row) }; },
  };
  vm.runInContext(built.outputFiles[0].text, context);
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const tick = async () => { const entries = [...timers.values()]; timers.clear(); for (const fn of entries) fn(); await flush(); };
  return { g: context.Fixture, calls, rows, writes, storage, flush, tick, setUser: value => { user = value; }, setRead: value => { handler = value; }, setPatch: value => { patchHandler = value; }, setPost: value => { postHandler = value; } };
}

test('legacy preferences are never attributed silently; unknown storage, tokens and transient state stay out', async () => {
  const e = environment({ 'claw-sidebar': JSON.stringify({ state: { userCollapsed: true, pinned: false, hiddenModules: ['mail'], hoverExpanded: true, mobileOpen: true } }), 'claw-auth': JSON.stringify({ accessToken: 'fixture-credential' }), 'claw-drive': JSON.stringify({ state: { density: 'compact', activeTab: 'trash', inspectorOpen: false } }) });
  const stop = e.g.activateUiPreferences('a'); await e.flush();
  assert.equal(e.g.useSidebarStore.getState().userCollapsed, false);
  const pending = plain(e.g.useUiPreferencesStore.getState().legacy);
  assert.equal(pending.sidebar.user_collapsed, true); assert.equal(pending.drive.density, 'compact');
  assert.equal(JSON.stringify(pending).includes('fixture-credential'), false);
  assert.equal('hoverExpanded' in pending.sidebar, false); assert.equal('activeTab' in pending.drive, false);
  assert.equal(e.calls.some(call => call.method !== 'GET'), false);
  await e.g.useUiPreferencesStore.getState().decideLegacy('adopt');
  assert.equal(e.g.useSidebarStore.getState().userCollapsed, true);
  assert.equal(e.g.useUiPreferencesStore.getState().legacyDecision, 'adopted');
  assert.equal(e.writes.length, 0); stop();
});

test('only persistent UI choices sync; logout resets the next user rather than sharing a cache', async () => {
  const e = environment(); const stopA = e.g.activateUiPreferences('a'); await e.flush();
  e.g.useSidebarStore.getState().setHoverExpanded(true); e.g.useSidebarStore.getState().setMobileOpen(true);
  e.g.useDriveStore.getState().setActiveTab('trash'); await e.tick();
  assert.equal(e.calls.some(call => call.method === 'PATCH'), false);
  e.g.useDriveStore.getState().setDensity('compact'); e.g.useCalendarUiStore.getState().setView('agenda'); await e.tick();
  const changes = e.calls.filter(call => call.method === 'PATCH'); assert.equal(changes.length, 1);
  assert.equal(changes[0].body.patch.drive.density, 'compact'); assert.equal(changes[0].body.patch.calendar.view, 'agenda');
  assert.equal('active_tab' in changes[0].body.patch.drive, false);
  stopA(); e.setUser('b'); const stopB = e.g.activateUiPreferences('b'); await e.flush();
  assert.equal(e.g.useDriveStore.getState().density, 'comfortable'); assert.equal(e.g.useDriveStore.getState().activeTab, 'my-drive');
  assert.equal(e.g.useCalendarUiStore.getState().view, null); assert.equal(e.g.useSidebarStore.getState().mobileOpen, false);
  assert.equal(e.writes.length, 0); stopB();
});

test('an old session response cannot hydrate the next user', async () => {
  const e = environment(); let finish;
  e.setRead(() => new Promise(resolve => { finish = resolve; }));
  const stopA = e.g.activateUiPreferences('a'); await e.flush(); stopA();
  e.setUser('b'); e.setRead(undefined); const stopB = e.g.activateUiPreferences('b'); await e.flush();
  finish({ data: { preferences: { ...plain(e.g.DEFAULT_UI_PREFERENCES), calendar: { view: 'month' } }, revision: 'late-a', legacy_decision: 'dismissed' } }); await e.flush();
  assert.equal(e.g.useUiPreferencesStore.getState().userId, 'b'); assert.equal(e.g.useCalendarUiStore.getState().view, null); stopB();
});

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
/** Instrument the HTTP/CAS boundary for independent browser stores. Core's
 * actual merge, schema and atomic CAS are tested by ui-preferences.test.ts. */
function automationBackend(...devices) {
  const rows = new Map(), hooks = {};
  const current = user => {
    if (!rows.has(user)) rows.set(user, { preferences: plain(devices[0].g.DEFAULT_UI_PREFERENCES), revision: `${user}:0`, legacy_decision: 'pending' });
    return rows.get(user);
  };
  const merge = (base, patch) => ({ ...base, ...patch, ...(patch.automation === undefined ? {} : { automation: { cron: true, hooks: false, ...base.automation, ...patch.automation } }) });
  for (const e of devices) {
    e.setRead(async user => { const response = { data: plain(current(user)) }; await hooks.read?.(e, user, response); return response; });
    e.setPatch(async (user, path, body) => {
      assert.equal(path, '/configuration/ui-preferences'); await hooks.beforePatch?.(e, user, body);
      const row = current(user);
      if (row.revision !== body.expected_revision) throw new e.g.ApiError('UI_PREFERENCES_CHANGED', 'fixture CAS');
      row.preferences = merge(row.preferences, body.patch); row.revision += '+';
      const response = { data: plain(row) }; await hooks.afterPatch?.(e, user, body, response); return response;
    });
    e.setPost(async (user, path, body) => {
      assert.equal(path, '/configuration/ui-preferences/legacy'); const row = current(user);
      if (row.legacy_decision !== 'pending') throw new e.g.ApiError('UI_LEGACY_ALREADY_RESOLVED', 'fixture legacy');
      if (row.revision !== body.expected_revision) throw new e.g.ApiError('UI_PREFERENCES_CHANGED', 'fixture CAS');
      if (body.decision === 'adopt') row.preferences = merge(row.preferences, body.preferences);
      row.legacy_decision = body.decision === 'adopt' ? 'adopted' : 'dismissed'; row.revision += '+';
      const response = { data: plain(row) }; await hooks.post?.(e, user, body, response); return response;
    });
  }
  return { rows, current, hooks };
}

test('automation independent panel deltas survive a two-device CAS retry without changing settings_groups snapshots', async () => {
  const a = environment(), b = environment(), backend = automationBackend(a, b);
  const stopA = a.g.activateUiPreferences('a'), stopB = b.g.activateUiPreferences('a'); await a.flush(); await b.flush();
  a.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', false);
  b.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', true);
  await a.tick(); await b.tick();
  assert.deepEqual(backend.current('a').preferences.automation, { cron: false, hooks: true });
  const bWrites = b.calls.filter(call => call.method === 'PATCH');
  assert.equal(bWrites.length, 2); assert.deepEqual(bWrites.map(call => call.body.patch), [{ automation: { hooks: true } }, { automation: { hooks: true } }]);
  assert.deepEqual(plain(b.g.useUiPreferencesStore.getState().preferences.automation), { cron: false, hooks: true });
  a.g.useUiPreferencesStore.getState().setSettingsGroups({ account: true, appearance: false }); await a.tick();
  a.g.useUiPreferencesStore.getState().setSettingsGroups({ account: false, appearance: true }); await a.tick();
  assert.deepEqual(backend.current('a').preferences.settings_groups, { account: false, appearance: true }, 'exclusive group snapshot semantics stay unchanged');
  assert.deepEqual(backend.current('a').preferences.automation, { cron: false, hooks: true });
  stopA(); stopB();
});

test('automation pending fields accumulate during an in-flight response and failed retry without losing the latest choice', async () => {
  const e = environment(), backend = automationBackend(e), held = deferred();
  let hold = true;
  backend.hooks.afterPatch = async () => { if (hold) { hold = false; await held.promise; } };
  const stop = e.g.activateUiPreferences('a'); await e.flush();
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', false); await e.tick();
  assert.equal(e.g.useUiPreferencesStore.getState().saving, true);
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', true);
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', true);
  held.resolve(); await e.flush();
  assert.deepEqual(plain(e.g.useUiPreferencesStore.getState().preferences.automation), { cron: true, hooks: true });
  await e.tick(); assert.deepEqual(backend.current('a').preferences.automation, { cron: true, hooks: true });
  let fail = true; backend.hooks.beforePatch = async () => { if (fail) { fail = false; throw new Error('fixture offline'); } };
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', false); await e.tick();
  assert.ok(e.g.useUiPreferencesStore.getState().error);
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', false); await e.tick();
  assert.deepEqual(backend.current('a').preferences.automation, { cron: false, hooks: false });
  assert.equal(e.g.useUiPreferencesStore.getState().error, null);
  assert.equal(e.writes.length, 0); stop();
});

test('automation intent before ready overlays only its panel and a late old-user write cannot hydrate or requeue into the next session', async () => {
  const e = environment(), backend = automationBackend(e), read = deferred();
  backend.current('a').preferences.automation = { cron: false, hooks: false };
  let holdRead = true; backend.hooks.read = async () => { if (holdRead) { holdRead = false; await read.promise; } };
  const stopA = e.g.activateUiPreferences('a'); await e.flush();
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', true);
  read.resolve(); await e.flush();
  assert.deepEqual(plain(e.g.useUiPreferencesStore.getState().preferences.automation), { cron: false, hooks: true });
  await e.tick();
  const write = deferred(); backend.hooks.afterPatch = async (_e, user) => { if (user === 'a') await write.promise; };
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', true); await e.tick();
  stopA(); e.setUser('b'); backend.current('b').preferences.automation = { cron: false, hooks: false };
  const stopB = e.g.activateUiPreferences('b'); await e.flush();
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', true); await e.tick();
  write.resolve(); await e.flush(); await e.tick();
  assert.equal(e.g.useUiPreferencesStore.getState().userId, 'b');
  assert.deepEqual(plain(e.g.useUiPreferencesStore.getState().preferences.automation), { cron: false, hooks: true });
  assert.deepEqual(backend.current('b').preferences.automation, { cron: false, hooks: true });
  assert.ok(e.calls.filter(call => call.method === 'PATCH' && call.user === 'b').every(call => !Object.hasOwn(call.body.patch.automation, 'cron')));
  stopB();
});

test('automation legacy proposal is bounded and never adopted, removed or attributed until the existing human decision', async () => {
  const raw = JSON.stringify({ cron: false, hooks: 'invalid', credential: 'fixture-not-a-preference' });
  const a = environment({ 'settings.automation.expanded': raw }), b = environment({ 'settings.automation.expanded': JSON.stringify({ cron: false, hooks: true }) });
  const backend = automationBackend(a, b), stopA = a.g.activateUiPreferences('a'); await a.flush();
  assert.deepEqual(plain(a.g.useUiPreferencesStore.getState().legacy), { automation: { cron: false, hooks: false } });
  assert.deepEqual(plain(a.g.useUiPreferencesStore.getState().preferences.automation), { cron: true, hooks: false });
  a.g.useUiPreferencesStore.getState().setAutomationExpanded('other', true);
  a.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', 'invalid'); await a.tick();
  assert.equal(a.calls.some(call => call.method === 'POST' || call.method === 'PATCH'), false);
  await a.g.useUiPreferencesStore.getState().decideLegacy('adopt');
  assert.deepEqual(backend.current('a').preferences.automation, { cron: false, hooks: false });
  assert.equal(backend.current('a').legacy_decision, 'adopted');
  assert.equal(a.storage.get('settings.automation.expanded'), raw); assert.equal(a.writes.length, 0);
  b.setUser('b'); const stopB = b.g.activateUiPreferences('b'); await b.flush();
  await b.g.useUiPreferencesStore.getState().decideLegacy('dismiss');
  assert.deepEqual(backend.current('b').preferences.automation, { cron: true, hooks: false });
  assert.equal(backend.current('b').legacy_decision, 'dismissed'); assert.equal(b.writes.length, 0);
  stopA(); stopB();
});

test('automation choice made while explicit legacy adoption is in flight wins after that response', async () => {
  const e = environment({ 'settings.automation.expanded': JSON.stringify({ cron: false, hooks: false }) }), backend = automationBackend(e), post = deferred();
  backend.hooks.post = async () => { await post.promise; };
  const stop = e.g.activateUiPreferences('a'); await e.flush();
  const adoption = e.g.useUiPreferencesStore.getState().decideLegacy('adopt'); await e.flush();
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('cron', true); await e.tick();
  post.resolve(); await adoption; await e.flush(); await e.tick();
  assert.equal(e.g.useUiPreferencesStore.getState().legacyDecision, 'adopted');
  assert.deepEqual(plain(e.g.useUiPreferencesStore.getState().preferences.automation), { cron: true, hooks: false });
  assert.deepEqual(backend.current('a').preferences.automation, { cron: true, hooks: false }); stop();
});

test('automation toggle after a failed initial read retains the error and pending field until refresh can drain it', async () => {
  const e = environment(), backend = automationBackend(e);
  backend.current('a').preferences.automation = { cron: false, hooks: false };
  backend.hooks.read = async () => { throw new Error('fixture unavailable'); };
  const stop = e.g.activateUiPreferences('a'); await e.flush();
  const error = e.g.useUiPreferencesStore.getState().error;
  assert.ok(error); assert.equal(e.g.useUiPreferencesStore.getState().ready, false);
  e.g.useUiPreferencesStore.getState().setAutomationExpanded('hooks', true); await e.tick();
  assert.equal(e.g.useUiPreferencesStore.getState().error, error, 'a queued choice cannot clear a read error while not ready to flush');
  assert.equal(e.g.useUiPreferencesStore.getState().saving, false);
  assert.equal(e.calls.filter(call => call.method === 'PATCH').length, 0);
  delete backend.hooks.read;
  await e.g.useUiPreferencesStore.getState().refresh(); await e.tick();
  assert.equal(e.g.useUiPreferencesStore.getState().ready, true);
  assert.equal(e.g.useUiPreferencesStore.getState().error, null);
  assert.deepEqual(plain(e.g.useUiPreferencesStore.getState().preferences.automation), { cron: false, hooks: true });
  assert.deepEqual(backend.current('a').preferences.automation, { cron: false, hooks: true });
  assert.deepEqual(e.calls.filter(call => call.method === 'PATCH').map(call => call.body.patch), [{ automation: { hooks: true } }]);
  assert.equal(e.writes.length, 0); stop();
});

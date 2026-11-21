import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [req.resolve('vite')] }));
const built = await esbuild.build({
  stdin: { contents: `export {subscribeConfigurationChanges} from './src/hooks/use-configuration-changes';export {useSettingsStore} from './src/stores/settings.store';export {useConfigurationStore} from './src/stores/configuration.store';`, resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'Fixture', platform: 'browser', tsconfig: path.join(root, 'tsconfig.app.json'), define: { 'import.meta.env.VITE_MOCK_API': '"false"' },
  plugins: [{ name: 'configuration-event-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/stores\/auth.store$|^\.\/auth.store$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/stores\/(settings|ui-preferences|websocket).store$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
      if (args.path === 'api') return { contents: `export class ApiError extends Error{constructor(code,message,details,status){super(message);this.code=code;this.status=status}};export const api={get:(...args)=>globalThis.fixture.api.get(...args),post:(...args)=>globalThis.fixture.api.post(...args),patch:(...args)=>globalThis.fixture.api.patch(...args)};` };
      if (args.path === 'auth') return { contents: `export const useAuthStore={getState:()=>globalThis.fixture.auth};` };
      if (args.path.includes('/settings.store')) return { contents: `export const useSettingsStore={getState:()=>globalThis.fixture.settings};` };
      if (args.path.includes('/ui-preferences.store')) return { contents: `export const useUiPreferencesStore={getState:()=>globalThis.fixture.preferences};` };
      return { contents: `export const useWebSocketStore={getState:()=>globalThis.fixture.websocket};` };
    });
  } }],
});
const plain = value => JSON.parse(JSON.stringify(value));
function environment() {
  let next = 0; const timers = new Map(), handlers = new Map(), calls = [], refreshes = [];
  const client = { on: (name, handler) => { handlers.set(name, handler); return () => handlers.delete(name); } };
  const fixture = { auth: { user: { id: 'user-a' }, isAuthenticated: true, sessionGeneration: 1 }, websocket: { client },
    settings: { fetchSettings: async () => { refreshes.push('settings'); } }, preferences: { refresh: async () => { refreshes.push('preferences'); } },
    api: { get: async (...args) => { calls.push({ method: 'GET', args }); return { data: {} }; }, post: async (...args) => { calls.push({ method: 'POST', args }); return { data: {} }; } } };
  const context = vm.createContext({ console, structuredClone, fixture, setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(built.outputFiles[0].text, context);
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  return { g: context.Fixture, fixture, client, calls, handlers, refreshes, timers, flush,
    emit: data => handlers.get('configuration.changed')?.({ event: 'configuration.changed', data }),
    tick: async () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); await flush(); } };
}
test('configuration events refresh settings/preferences once per burst only for the current recipient and socket', async () => {
  const e = environment(); const stop = e.g.subscribeConfigurationChanges();
  e.emit({ user_id: 'another-user', scope: 'personal' }); e.emit({ user_id: 'user-a', scope: 'unknown' }); await e.tick(); assert.deepEqual(e.refreshes, []);
  e.emit({ user_id: 'user-a', scope: 'personal', blocks: ['appearance_preferences'] }); e.emit({ user_id: 'user-a', scope: 'instance' }); await e.tick();
  assert.deepEqual(e.refreshes, ['settings', 'preferences']);
  e.emit({ user_id: 'user-a', scope: 'personal' }); e.fixture.auth = { ...e.fixture.auth, sessionGeneration: 2 }; await e.tick(); assert.equal(e.refreshes.length, 2);
  e.fixture.auth.sessionGeneration = 1; e.fixture.websocket.client = {}; e.emit({ user_id: 'user-a', scope: 'personal' }); await e.tick(); assert.equal(e.refreshes.length, 2);
  stop(); assert.equal(e.handlers.size, 0); assert.equal(e.timers.size, 0);
});
test('a remote event preserves each dirty draft/base, updates clean sections and offers the latest server version on discard', async () => {
  const e = environment(); let server = { general: { language: 'en' }, dash: { theme: 'dark' } };
  e.fixture.api.get = async () => ({ data: server });
  await e.g.useSettingsStore.getState().fetchSettings();
  e.g.useSettingsStore.getState().setLocalValue('general.language', 'local-draft');
  const original = plain(e.g.useSettingsStore.getState().original.general);
  e.fixture.settings = e.g.useSettingsStore.getState();
  const stop = e.g.subscribeConfigurationChanges();
  server = { general: { language: 'remote-change' }, dash: { theme: 'light' } };
  e.emit({ user_id: 'user-a', scope: 'personal' }); await e.tick();
  const state = e.g.useSettingsStore.getState();
  assert.equal(state.settings.general.language, 'local-draft'); assert.equal(state.dirty.general, true);
  assert.deepEqual(plain(state.original.general), original); assert.equal(state.remoteConflicts.general, true);
  assert.equal(state.settings.dash.theme, 'light'); assert.equal(state.original.dash.theme, 'light');
  assert.deepEqual(plain(state.remoteConflicts), { general: true });
  state.setLocalValue('general.language', original.language);
  assert.equal(e.g.useSettingsStore.getState().dirty.general, true); assert.equal(e.g.useSettingsStore.getState().remoteConflicts.general, true);
  state.resetSection('general');
  assert.equal(e.g.useSettingsStore.getState().settings.general.language, 'remote-change');
  assert.equal(e.g.useSettingsStore.getState().original.general.language, 'remote-change');
  assert.equal(e.g.useSettingsStore.getState().dirty.general, false); assert.deepEqual(plain(e.g.useSettingsStore.getState().remoteConflicts), {});
  stop();
});
test('a failed refresh preserves the draft, and a new session clears its private draft/base before loading', async () => {
  const e = environment(); e.fixture.api.get = async () => ({ data: { general: { language: 'en' } } });
  await e.g.useSettingsStore.getState().fetchSettings(); e.g.useSettingsStore.getState().setLocalValue('general.language', 'local-draft');
  e.fixture.api.get = async () => { throw new Error('fixture network failure'); }; await e.g.useSettingsStore.getState().fetchSettings();
  assert.equal(e.g.useSettingsStore.getState().settings.general.language, 'local-draft'); assert.equal(e.g.useSettingsStore.getState().original.general.language, 'en'); assert.equal(e.g.useSettingsStore.getState().dirty.general, true);
  e.fixture.auth = { ...e.fixture.auth, user: { id: 'user-b' }, sessionGeneration: 2 };
  let finish; e.fixture.api.get = () => new Promise(resolve => { finish = resolve; });
  const loading = e.g.useSettingsStore.getState().fetchSettings();
  assert.equal(e.g.useSettingsStore.getState().settings, null); assert.equal(e.g.useSettingsStore.getState().original, null);
  assert.deepEqual(plain(e.g.useSettingsStore.getState().dirty), {}); assert.deepEqual(plain(e.g.useSettingsStore.getState().remoteConflicts), {});
  finish({ data: { general: { language: 'new-user' } } }); await loading;
  assert.equal(e.g.useSettingsStore.getState().settings.general.language, 'new-user');
});
test('observed Ollama status does not create a configuration conflict for an AI draft', async () => {
  const e = environment(); e.fixture.api.get = async () => ({ data: {} }); await e.g.useSettingsStore.getState().fetchSettings();
  const remote = plain(e.g.useSettingsStore.getState().serverSettings);
  e.g.useSettingsStore.getState().setLocalValue('ai.default_model', 'local-draft');
  remote.ai.local_models.ollama_status = 'connected'; remote.ai.local_models.available_models = ['observed-model'];
  e.fixture.api.get = async () => ({ data: remote }); await e.g.useSettingsStore.getState().fetchSettings();
  assert.equal(e.g.useSettingsStore.getState().dirty.ai, true); assert.equal(e.g.useSettingsStore.getState().settings.ai.default_model, 'local-draft');
  assert.equal(e.g.useSettingsStore.getState().remoteConflicts.ai, undefined);
});
test('saving one section retains a draft and its original in another section', async () => {
  const e = environment(); e.fixture.api.get = async () => ({ data: {} }); await e.g.useSettingsStore.getState().fetchSettings();
  const remote = plain(e.g.useSettingsStore.getState().serverSettings);
  e.g.useSettingsStore.getState().setLocalValue('general.language', 'fr'); e.g.useSettingsStore.getState().setLocalValue('dash.theme', 'light');
  e.fixture.api.patch = async (_url, body) => ({ data: { ...remote, ...body } });
  await e.g.useSettingsStore.getState().updateSection('general', e.g.useSettingsStore.getState().settings.general);
  const state = e.g.useSettingsStore.getState();
  assert.equal(state.dirty.general, false); assert.equal(state.settings.general.language, 'fr');
  assert.equal(state.dirty.dash, true); assert.equal(state.settings.dash.theme, 'light'); assert.equal(state.original.dash.theme, 'dark');
});
test('a stale view cannot submit the previous account settings through the next session', async () => {
  const e = environment(); e.fixture.api.get = async () => ({ data: {} }); await e.g.useSettingsStore.getState().fetchSettings();
  e.g.useSettingsStore.getState().setLocalValue('general.language', 'fr');
  e.fixture.auth = { ...e.fixture.auth, user: { id: 'user-b' }, sessionGeneration: 2 };
  let writes = 0; e.fixture.api.patch = async () => { writes++; return { data: {} }; };
  await assert.rejects(e.g.useSettingsStore.getState().updateSection('general', { language: 'fr' }));
  await assert.rejects(e.g.useSettingsStore.getState().patchSettings({ general: { language: 'fr' } }));
  assert.equal(writes, 0);
});
for (const failed of [false, true]) test(`late settings ${failed ? 'failure' : 'success'} cannot overwrite a new session`, async () => {
  const e = environment(); let finish;
  e.fixture.api.get = () => new Promise((resolve, reject) => { finish = failed ? () => reject(new Error('fixture late failure')) : () => resolve({ data: { general: { language: 'old-user' } } }); });
  const request = e.g.useSettingsStore.getState().fetchSettings(); e.fixture.auth = { ...e.fixture.auth, user: { id: 'user-b' }, sessionGeneration: 2 };
  e.g.useSettingsStore.setState({ settings: { general: { language: 'new-user' } } }); finish(); await request;
  assert.equal(e.g.useSettingsStore.getState().settings.general.language, 'new-user');
});
test('mapping selection is explicit, candidate-bound, and only applies after a new preview revision', async () => {
  const e = environment(); const target = '20000000-0000-4000-8000-000000000001';
  const preview = { id: 'operation', preview_revision: 'old-preview', blocks: [], changes: [], preserved: [], omissions: [], blockers: [], warnings: [], activation: [], can_apply: true,
    mapping_requests: [{ kind: 'user', source_id: 'source-id', source_label: 'Same display name', message: 'Choose explicitly', required: true, candidates: [{ id: target, label: 'Same display name' }] }], mappings: [] };
  const operation = { id: 'operation', status: 'prepared', created_at: 'fixture', updated_at: 'fixture', preview, results: [] };
  e.g.useConfigurationStore.setState({ mode: 'import', operation, preview, selected: ['users_groups'] });
  assert.equal(e.g.useConfigurationStore.getState().mappings.length, 0);
  e.g.useConfigurationStore.getState().mapReference('user', 'source-id', 'Same display name');
  e.g.useConfigurationStore.getState().mapReference('user', 'source-id', '30000000-0000-4000-8000-000000000001');
  assert.equal(e.g.useConfigurationStore.getState().mappings.length, 0);
  e.g.useConfigurationStore.getState().mapReference('user', 'source-id', target);
  assert.equal(e.g.useConfigurationStore.getState().previewDirty, true); await e.g.useConfigurationStore.getState().apply(false); assert.equal(e.calls.length, 0);
  e.fixture.api.post = async (url, body) => {
    e.calls.push({ url, body: plain(body) });
    if (url.endsWith('/preview')) return { data: { ...preview, preview_revision: 'bound-preview', mappings: plain(body.mappings) } };
    return { data: { ...operation, status: 'completed', preview: { ...preview, preview_revision: 'bound-preview', mappings: [{ kind: 'user', source_id: 'source-id', target_id: target }] } } };
  };
  await e.g.useConfigurationStore.getState().prepare();
  assert.deepEqual(e.calls[0].body.mappings, [{ kind: 'user', source_id: 'source-id', target_id: target }]);
  assert.equal(e.g.useConfigurationStore.getState().previewDirty, false);
  await e.g.useConfigurationStore.getState().apply(false);
  assert.equal(e.calls[1].body.preview_revision, 'bound-preview'); assert.equal('mappings' in e.calls[1].body, false);
  e.g.useConfigurationStore.getState().reset(); assert.equal(e.g.useConfigurationStore.getState().mappings.length, 0);
});
test('a control-only operation clears selection and cannot prepare or apply, but can be cancelled', async () => {
  const e = environment(); const operation = { id: 'control-operation', status: 'stopped', created_at: 'fixture', updated_at: 'fixture', preview: null, results: [], control_only: true };
  e.fixture.api.get = async url => ({ data: url === '/configuration/catalog' ? { format_version: 1, blocks: [{ id: 'appearance_preferences', authorized: true, available: true }], coverage: { complete: false, issues: [] } } : url === '/configuration/snapshot' ? { revision: 'fixture', generated_at: 'fixture', scope: 'personal', status: 'updated', blocks: {}, warnings: [] } : operation });
  await e.g.useConfigurationStore.getState().load();
  assert.equal(e.g.useConfigurationStore.getState().operation.control_only, true);
  assert.equal(e.g.useConfigurationStore.getState().selected.length, 0); assert.equal(e.g.useConfigurationStore.getState().preview, null);
  await e.g.useConfigurationStore.getState().prepare(); await e.g.useConfigurationStore.getState().apply(false); await e.g.useConfigurationStore.getState().apply(false, true);
  assert.equal(e.calls.length, 0);
  e.fixture.api.post = async (url, body) => { e.calls.push({ url, body }); return { data: { ...operation, status: 'cancelled' } }; };
  await e.g.useConfigurationStore.getState().cancel();
  assert.equal(e.calls[0].url, '/configuration/imports/control-operation/cancel'); assert.equal(e.g.useConfigurationStore.getState().operation, null);
});

test('recovery opens only a preview, respects active operations and ignores a prior session response', async () => {
  const e = environment(); const preview = { id: 'recovery-operation', preview_revision: 'revision', blocks: [{ id: 'appearance_preferences', selected: true }], mappings: [] };
  const operation = { id: preview.id, status: 'prepared', preview, results: [] };
  e.fixture.api.post = async (url, body) => { e.calls.push({ url, body }); return { data: operation }; };
  assert.equal(await e.g.useConfigurationStore.getState().openRecovery('point-id'), true);
  assert.equal(e.calls.length, 1); assert.equal(e.calls[0].url, '/configuration/recovery/point-id/open');
  assert.equal(e.g.useConfigurationStore.getState().mode, 'import'); assert.deepEqual(plain(e.g.useConfigurationStore.getState().selected), ['appearance_preferences']);
  assert.equal(await e.g.useConfigurationStore.getState().openRecovery('other-point'), false); assert.equal(e.calls.length, 1);
  e.g.useConfigurationStore.getState().reset(); let finish;
  e.fixture.api.post = () => new Promise(resolve => { finish = () => resolve({ data: operation }); });
  const request = e.g.useConfigurationStore.getState().openRecovery('point-id');
  e.fixture.auth = { ...e.fixture.auth, sessionGeneration: 2, user: { id: 'user-b' } }; e.g.useConfigurationStore.getState().reset();
  finish(); assert.equal(await request, false); assert.equal(e.g.useConfigurationStore.getState().operation, null);
});

test('an instance recovery displays its actual scope and reloads the matching catalog before enabling actions', async () => {
  const e = environment(); e.fixture.auth.user.role = 'admin';
  const preview = { id: 'instance-recovery', preview_revision: 'revision', blocks: [{ id: 'users_groups', selected: true }], mappings: [] };
  const operation = { id: preview.id, scope: 'instance', status: 'prepared', preview, results: [] };
  e.fixture.api.post = async () => ({ data: operation });
  e.fixture.api.get = async (url, query) => {
    e.calls.push({ url, query });
    return { data: url === '/configuration/catalog' ? { blocks: [{ id: 'users_groups', available: true, authorized: true }] } : url === '/configuration/snapshot' ? { scope: query.scope } : operation };
  };
  assert.equal(await e.g.useConfigurationStore.getState().openRecovery('instance-point'), true);
  assert.equal(e.g.useConfigurationStore.getState().scope, 'instance'); assert.equal(e.g.useConfigurationStore.getState().snapshot.scope, 'instance');
  assert.equal(e.calls.find(call => call.url === '/configuration/catalog').query.scope, 'instance'); assert.equal(e.g.useConfigurationStore.getState().busy, false);
});

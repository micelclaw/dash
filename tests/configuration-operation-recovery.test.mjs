import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [req.resolve('vite')] }));
const built = await esbuild.build({
  stdin: { contents: "export {useConfigurationStore} from './src/stores/configuration.store';", resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'Fixture', platform: 'browser', tsconfig: path.join(root, 'tsconfig.app.json'),
  plugins: [{ name: 'operation-recovery-closed-ports', setup(builder) {
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\.\/auth.store$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth'
      ? 'export const useAuthStore={getState:()=>globalThis.fixture.auth};'
      : 'export class ApiError extends Error{};export const api={get:(...args)=>globalThis.fixture.get(...args),post:(...args)=>globalThis.fixture.post(...args)};' }));
  } }],
});
const source = 'a2000000-0000-4000-8000-000000000001', target = 'a2000000-0000-4000-8000-000000000002';
const catalog = { format_version: 1, blocks: ['appearance_preferences', 'system_automation'].map(id => ({ id, label: id, authorized: true, available: true })), coverage: { complete: false, issues: [] }, export: { scope: 'personal', available: true } };
function operation(id = 'known-operation', status = 'applying') {
  return { id, scope: 'personal', status, created_at: '2026-11-17T00:00:00Z', updated_at: '2026-11-17T00:00:00Z',
    preview: { id, preview_revision: `preview-${id}`, blocks: catalog.blocks.map(block => ({ ...block, selected: true, present: true, compatible: true })), mappings: [], mapping_requests: [{ kind: 'user', source_id: source, required: true, candidates: [{ id: target, label: 'Selected fixture account' }] }], can_apply: true },
    results: [{ id: 'appearance_preferences', state: status === 'applying' ? 'applying' : 'verified', message: '', applied_adapters: [] }],
  };
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  const calls = [], ports = { current: async () => null, byId: async () => { throw Error('operation unavailable'); }, catalog: async () => catalog, open: async () => operation(), apply: async () => operation(), cancel: async () => ({}), preview: async () => operation().preview };
  const input = { auth: { user: { id: 'fixture-owner' }, sessionGeneration: 1 },
    async get(url, query) {
      calls.push({ method: 'GET', url, query });
      if (url === '/configuration/catalog') return { data: await ports.catalog(query) };
      if (url === '/configuration/snapshot') return { data: { scope: query.scope, generated_at: '2026-11-17T00:00:00Z', warnings: [] } };
      if (url === '/configuration/imports/current') return { data: await ports.current() };
      if (/^\/configuration\/imports\/[^/]+$/.test(url)) return { data: await ports.byId(url.split('/').at(-1)) };
      throw Error(`Unclassified fixture GET ${url}`);
    },
    async post(url, body) {
      calls.push({ method: 'POST', url, body });
      if (url === '/configuration/imports/open') return { data: await ports.open(body) };
      if (url.endsWith('/apply')) return { data: await ports.apply(body) };
      if (url.endsWith('/cancel')) return { data: await ports.cancel(body) };
      if (url.endsWith('/preview')) return { data: await ports.preview(body) };
      throw Error(`Unclassified fixture POST ${url}`);
    },
  };
  const context = vm.createContext({ console, structuredClone, fixture: input, fetch() { throw Error('Live network forbidden'); } });
  vm.runInContext(built.outputFiles[0].text, context);
  const store = context.Fixture.useConfigurationStore;
  async function open(value = operation()) { ports.open = async () => value; store.getState().begin('import'); assert.equal(await store.getState().open('fixture-encrypted-file', 'fixture-password'), true); }
  const byIdCalls = () => calls.filter(call => call.method === 'GET' && call.url === '/configuration/imports/known-operation').length;
  return { store, ports, input, calls, open, byIdCalls };
}

test('failed/null current and negative/error ID reads preserve the known applying record without quiescence or writes', async () => {
  for (const pointer of ['error', 'null']) for (const byId of ['error', 'null', 'different-id', 'different-scope']) {
    const f = fixture(); await f.open();
    f.ports.current = async () => { if (pointer === 'error') throw Error('pointer unavailable'); return null; };
    f.ports.byId = async () => { if (byId === 'error') throw Error('ID unavailable'); return byId === 'null' ? null : byId === 'different-id' ? operation('other', 'cancelled') : { ...operation('known-operation', 'completed'), scope: 'instance' }; };
    await f.store.getState().load('personal'); const state = f.store.getState();
    assert.equal(state.operation?.id, 'known-operation'); assert.equal(state.operation?.status, 'applying'); assert.equal(state.preview?.preview_revision, 'preview-known-operation'); assert.equal(state.mode, 'import'); assert.ok(state.error); assert.match(state.notice, /último estado/); assert.equal(f.byIdCalls(), 1);
    assert.deepEqual(f.calls.filter(call => call.method === 'POST').map(call => call.url), ['/configuration/imports/open']);
  }
});
test('a consistent ID or current receipt may confirm terminal state; an unrelated current operation does not replace a known active one', async () => {
  for (const path of ['id', 'current']) {
    const f = fixture(); await f.open();
    f.ports.current = async () => path === 'current' ? operation('known-operation', 'completed') : operation('other-operation', 'cancelled');
    f.ports.byId = async id => operation(id, 'completed'); await f.store.getState().load();
    assert.equal(f.store.getState().operation?.id, 'known-operation'); assert.equal(f.store.getState().operation?.status, 'completed'); assert.equal(f.byIdCalls(), path === 'id' ? 1 : 0);
  }
});
test('fallback preserves dirty selected blocks, mappings and preview, including edits while the ID read waits', async () => {
  for (const outcome of ['error', 'confirmed']) {
    const f = fixture(), pending = deferred(); await f.open(); f.ports.byId = () => pending.promise;
    const read = f.store.getState().load();
    await new Promise(resolve => setImmediate(resolve));
    f.store.getState().select('system_automation', false); f.store.getState().mapReference('user', source, target);
    const dirty = f.store.getState(); assert.equal(dirty.previewDirty, true);
    if (outcome === 'error') pending.reject(Error('temporarily unavailable')); else pending.resolve({ ...operation(), preview: { ...operation().preview, preview_revision: 'other-server-preview' } });
    await read; const state = f.store.getState();
    assert.equal(state.previewDirty, true); assert.equal(state.preview, dirty.preview); assert.deepEqual(state.selected, dirty.selected); assert.deepEqual(state.mappings, dirty.mappings); assert.equal(state.operation?.status, 'applying');
  }
});
test('catalog failure still checks the known operation ID while keeping export catalog invalidated', async () => {
  const f = fixture(); await f.open(); f.ports.catalog = async () => { throw Error('catalog unavailable'); }; f.ports.byId = async () => operation();
  await f.store.getState().load(); assert.equal(f.byIdCalls(), 1); assert.equal(f.store.getState().operation?.status, 'applying'); assert.equal(f.store.getState().catalog, null); assert.ok(f.store.getState().error);
});
test('session/account changes clear the old owner and reset prevents late old reads from resurrecting its record', async () => {
  for (const change of ['generation', 'account', 'reset']) {
    const f = fixture(), pending = deferred(); await f.open(); f.ports.current = () => pending.promise;
    const read = f.store.getState().load();
    if (change === 'generation') f.input.auth.sessionGeneration++;
    if (change === 'account') f.input.auth.user.id = 'another-fixture-owner';
    f.store.getState().reset(); pending.resolve(operation()); await read;
    assert.equal(f.store.getState().operation, null); assert.equal(f.store.getState().preview, null); assert.equal(f.store.getState().mode, 'idle'); assert.equal(f.store.getState().catalog, null);
    f.ports.current = async () => null; await f.store.getState().load(); assert.equal(f.store.getState().operation, null); assert.equal(f.byIdCalls(), 0);
  }
  const f = fixture(); await f.open(); f.input.auth.user.id = 'another-fixture-owner';
  await f.store.getState().load(); assert.equal(f.store.getState().operation, null); assert.equal(f.byIdCalls(), 0);
});
test('an older load or delayed ID fallback cannot overwrite a newly opened operation in the same session', async () => {
  for (const phase of ['pointer', 'fallback']) {
    const f = fixture(), pending = deferred(); await f.open();
    if (phase === 'pointer') f.ports.current = () => pending.promise; else f.ports.byId = () => pending.promise;
    const read = f.store.getState().load(); await new Promise(resolve => setImmediate(resolve));
    await f.open(operation('new-operation', 'prepared'));
    pending.resolve(operation('known-operation', 'completed')); await read;
    assert.equal(f.store.getState().operation?.id, 'new-operation'); assert.equal(f.store.getState().preview?.preview_revision, 'preview-new-operation'); assert.equal(f.store.getState().busy, false); assert.equal(f.store.getState().mode, 'import');
  }
});
test('late refresh/prepare/apply/cancel callbacks cannot mutate a different newly opened operation', async () => {
  for (const action of ['refreshOperation', 'prepare', 'apply', 'cancel']) {
    const f = fixture(), pending = deferred(); await f.open(operation('known-operation', 'prepared'));
    if (action === 'refreshOperation') f.ports.byId = () => pending.promise;
    if (action === 'prepare') f.ports.preview = () => pending.promise;
    if (action === 'apply') f.ports.apply = () => pending.promise;
    if (action === 'cancel') f.ports.cancel = () => pending.promise;
    const old = f.store.getState()[action](false);
    await f.open(operation('new-operation', 'prepared'));
    pending.resolve(action === 'prepare' ? operation().preview : operation('known-operation', 'completed')); await old;
    assert.equal(f.store.getState().operation?.id, 'new-operation'); assert.equal(f.store.getState().preview?.preview_revision, 'preview-new-operation'); assert.equal(f.store.getState().busy, false);
  }
});
test('confirmed cancellation clears the record and later null/error reads do not manufacture another operation', async () => {
  const f = fixture(); await f.open(operation('known-operation', 'prepared')); await f.store.getState().cancel();
  assert.equal(f.store.getState().operation, null); f.ports.current = async () => { throw Error('pointer unavailable'); };
  await f.store.getState().load(); assert.equal(f.store.getState().operation, null); assert.equal(f.byIdCalls(), 0);
  assert.equal(f.calls.filter(call => call.method === 'POST' && call.url.endsWith('/cancel')).length, 1);
});
test('a consistent control-only receipt replaces cached preview and dirty mappings instead of preserving revoked editing authority', async () => {
  for (const path of ['current', 'id', 'refresh']) {
    const f = fixture(); await f.open(); f.store.getState().select('system_automation', false); f.store.getState().mapReference('user', source, target);
    assert.equal(f.store.getState().previewDirty, true);
    const reduced = { ...operation(), control_only: true, preview: null };
    f.ports.current = async () => path === 'current' ? reduced : null; f.ports.byId = async () => reduced;
    if (path === 'refresh') await f.store.getState().refreshOperation(); else await f.store.getState().load();
    const state = f.store.getState(); assert.equal(state.operation?.control_only, true); assert.equal(state.preview, null); assert.equal(state.previewDirty, false); assert.equal(state.selected.length, 0); assert.equal(state.mappings.length, 0);
  }
});
test('an already known in-memory record belongs to its existing session and is preserved by ID fallback', async () => {
  const f = fixture(), known = operation();
  f.store.setState({ operation: known, preview: known.preview, mode: 'import', selected: ['appearance_preferences'] });
  await f.store.getState().load(); assert.equal(f.store.getState().operation?.id, known.id); assert.equal(f.store.getState().operation?.status, 'applying'); assert.equal(f.byIdCalls(), 1);
  f.input.auth.user.id = 'another-fixture-owner'; await f.store.getState().load(); assert.equal(f.store.getState().operation, null); assert.equal(f.byIdCalls(), 1);
});

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
  plugins: [{ name: 'export-readiness-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\.\/auth.store$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth'
      ? 'export const useAuthStore={getState:()=>globalThis.fixture.auth};'
      : 'export class ApiError extends Error{};export const api={get:(...args)=>globalThis.fixture.get(...args),post:(...args)=>globalThis.fixture.post(...args)};' }));
  } }],
});
const legacyCatalog = () => ({ format_version: 1, blocks: [{ id: 'appearance_preferences', authorized: true, available: true }], coverage: { complete: false, issues: [] } });
function environment(scope = 'personal', catalog = legacyCatalog()) {
  const calls = [];
  const fixture = { auth: { sessionGeneration: 1 }, get: async () => { throw Error('fixture catalog unavailable'); }, post: async (...args) => {
    calls.push(args); return { data: { filename: 'fixture.micelcfg', file: 'fixture-ciphertext', warnings: [] } };
  } };
  const context = vm.createContext({ console, structuredClone, fixture });
  vm.runInContext(built.outputFiles[0].text, context);
  const store = context.Fixture.useConfigurationStore;
  store.setState({ scope, catalog, selected: ['appearance_preferences'] });
  return { store, calls, fixture };
}
test('legacy personal catalogs still export selected authorized settings', async () => {
  const { store, calls } = environment();
  store.getState().begin('export');
  assert.equal(store.getState().mode, 'export');
  assert.equal((await store.getState().export('fixture-archive-password')).file, 'fixture-ciphertext');
  assert.equal(calls.length, 1); assert.equal(calls[0][1].scope, 'personal');
  assert.equal(Object.hasOwn(store.getState(), 'password'), false);
});
test('unknown or blocked instance readiness never opens export or transmits passwords', async () => {
  for (const catalog of [null, legacyCatalog(), { ...legacyCatalog(), coverage: { complete: true, issues: [] } },
    { ...legacyCatalog(), export: { scope: 'instance', available: false, reason: 'fixture unavailable' } },
    { ...legacyCatalog(), export: { scope: 'instance', available: true } }]) {
    const { store, calls } = environment('instance', catalog);
    store.getState().begin('export');
    assert.equal(store.getState().mode, 'idle');
    assert.equal(await store.getState().export('fixture-archive-password', 'fixture-reauth-password'), null);
    assert.equal(calls.length, 0); assert.ok(store.getState().error);
  }
});
test('a personal catalog cannot authorize a scope changed while the form is open', async () => {
  const catalog = { ...legacyCatalog(), coverage: { complete: true, issues: [] }, export: { scope: 'personal', available: true } };
  const { store, calls } = environment('personal', catalog);
  store.getState().begin('export'); assert.equal(store.getState().mode, 'export');
  store.setState({ scope: 'instance' });
  assert.equal(await store.getState().export('fixture-archive-password', 'fixture-reauth-password'), null);
  assert.equal(calls.length, 0);
});
test('readiness revoked after opening is checked again without preventing import', async () => {
  const catalog = { ...legacyCatalog(), export: { scope: 'personal', available: true } };
  const { store, calls } = environment('personal', catalog);
  store.getState().begin('export'); assert.equal(store.getState().mode, 'export');
  store.setState({ catalog: { ...catalog, export: { scope: 'personal', available: false, reason: 'fixture revoked' } } });
  assert.equal(await store.getState().export('fixture-archive-password'), null);
  assert.equal(calls.length, 0); assert.equal(store.getState().error, 'fixture revoked');
  store.getState().begin('import'); assert.equal(store.getState().mode, 'import');
});
test('a failed scope read cannot retain a legacy catalog from another scope', async () => {
  const { store, calls } = environment('instance', legacyCatalog());
  await store.getState().load('personal');
  assert.equal(store.getState().catalog, null);
  store.getState().begin('export'); assert.equal(store.getState().mode, 'idle');
  assert.equal(await store.getState().export('fixture-archive-password'), null);
  assert.equal(calls.length, 0);
});
test('a superseded legacy catalog cannot replace the latest scope or its selected blocks', async () => {
  const { store, calls, fixture } = environment();
  let resolveInstance;
  fixture.get = async (url, query) => {
    if (url.endsWith('/catalog')) {
      if (query.scope === 'instance') return new Promise(resolve => { resolveInstance = resolve; });
      return { data: legacyCatalog() };
    }
    return { data: null };
  };
  const old = store.getState().load('instance');
  await store.getState().load('personal');
  resolveInstance({ data: { ...legacyCatalog(), blocks: [{ id: 'users_groups', authorized: true, available: true }] } });
  await old;
  assert.equal(store.getState().scope, 'personal');
  assert.deepEqual(Array.from(store.getState().selected), ['appearance_preferences']);
  store.getState().begin('export'); await store.getState().export('fixture-archive-password');
  assert.equal(calls.length, 1); assert.deepEqual(Array.from(calls[0][1].blocks), ['appearance_preferences']);
});

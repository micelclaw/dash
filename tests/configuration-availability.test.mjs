import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [req.resolve('vite')] }));
const built = await esbuild.build({
  stdin: { contents: `export {useConfigurationAvailabilityStore,configurationAvailabilitySessionKey} from './src/stores/configuration-availability.store';export {ApiError} from '@/services/api';`, resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'Fixture', platform: 'browser', tsconfig: path.join(root, 'tsconfig.app.json'),
  plugins: [{ name: 'availability-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\.\/auth.store$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /api/, namespace: 'fixture' }, () => ({ contents: `export class ApiError extends Error{constructor(code,message,details,status){super(message);this.code=code;this.status=status}};export const api={get:(...args)=>globalThis.fixtureGet(...args)};` }));
    builder.onLoad({ filter: /auth/, namespace: 'fixture' }, () => ({ contents: `export const useAuthStore={getState:()=>globalThis.fixtureAuth};` }));
  } }],
});
const catalog = { format_version: 1, blocks: [{ id: 'appearance_preferences', label: 'Apariencia y preferencias', authorized: true, available: true }], coverage: { complete: false, issues: [] } };
function environment() {
  const calls = [];
  let response = async () => ({ data: catalog });
  const context = vm.createContext({ console, fixtureAuth: { user: { id: 'paco-fixture' }, isAuthenticated: true, sessionGeneration: 1 }, fixtureGet: (...args) => { calls.push(args); return response(...args); } });
  vm.runInContext(built.outputFiles[0].text, context);
  return { g: context.Fixture, context, calls, respond: handler => { response = handler; }, flush: async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); } };
}
for (const code of [404, 503]) test(`catalog ${code} keeps configuration unavailable, then a valid response reveals it`, async () => {
  const e = environment(); e.respond(async () => { throw new e.g.ApiError('UNAVAILABLE', 'Implementation detail must not be shown', undefined, code); });
  await e.g.useConfigurationAvailabilityStore.getState().check();
  assert.equal(e.g.useConfigurationAvailabilityStore.getState().status, 'unavailable');
  assert.equal(JSON.stringify(e.g.useConfigurationAvailabilityStore.getState()).includes('Implementation detail'), false);
  e.respond(async () => ({ data: catalog })); await e.g.useConfigurationAvailabilityStore.getState().check();
  assert.equal(e.g.useConfigurationAvailabilityStore.getState().status, 'available');
  assert.equal(e.calls.length, 2); assert.equal(e.calls[0][0], '/configuration/catalog'); assert.equal(e.calls[0][1].scope, 'personal');
});
test('one probe is shared and a response from an old session cannot reveal the entry', async () => {
  const e = environment(); let finish;
  e.respond(() => new Promise(resolve => { finish = resolve; }));
  const first = e.g.useConfigurationAvailabilityStore.getState().check();
  const duplicate = e.g.useConfigurationAvailabilityStore.getState().check(); await e.flush(); assert.equal(e.calls.length, 1);
  e.context.fixtureAuth = { user: { id: 'another-fixture' }, isAuthenticated: true, sessionGeneration: 2 };
  e.respond(async () => { throw new e.g.ApiError('UNAVAILABLE', 'fixture', undefined, 404); });
  await e.g.useConfigurationAvailabilityStore.getState().check();
  finish({ data: catalog }); await Promise.all([first, duplicate]);
  assert.equal(e.g.useConfigurationAvailabilityStore.getState().sessionKey, 'another-fixture:2');
  assert.equal(e.g.useConfigurationAvailabilityStore.getState().status, 'unavailable');
});
test('health-like payloads and unauthenticated sessions cannot enable configuration', async () => {
  const e = environment(); e.respond(async () => ({ data: { ready: true } })); await e.g.useConfigurationAvailabilityStore.getState().check();
  assert.equal(e.g.useConfigurationAvailabilityStore.getState().status, 'unavailable');
  e.context.fixtureAuth = { user: null, isAuthenticated: false, sessionGeneration: 2 };
  await e.g.useConfigurationAvailabilityStore.getState().check(); assert.equal(e.calls.length, 1);
  assert.equal(e.g.configurationAvailabilitySessionKey(), null);
});

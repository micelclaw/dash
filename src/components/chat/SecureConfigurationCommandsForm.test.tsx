// @ts-nocheck -- Browser fixture boundary; real component and API client are bundled below.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DASH = fileURLToPath(new URL('../../../', import.meta.url));
const CORE = path.resolve(DASH, '../micelclaw-os/core');
const { build } = await import(pathToFileURL(path.join(CORE, 'node_modules/esbuild/lib/main.js')).href);
const { chromium, expect } = await import(pathToFileURL(path.join(DASH, 'node_modules/@playwright/test/index.mjs')).href);
const { commandsControlsSchema } = await import(pathToFileURL(path.join(CORE, 'src/services/configuration/commands-contracts.ts')).href);
const { z } = await import(pathToFileURL(path.join(CORE, 'node_modules/zod/index.js')).href);
const origin = 'http://s10-commands.fixture';
const operationId = '00000000-0000-4000-8000-000000000011';
const conversationId = '00000000-0000-4000-8000-000000000012';
let browser, bundle;

before(async () => {
  const stubs = {
    '@/stores/auth.store': `import{useSyncExternalStore}from'react';const state={sessionGeneration:1,logoutState:'idle',tokens:null,user:{id:'fixture-human',role:'admin'}};export const useAuthStore=select=>useSyncExternalStore(()=>()=>{},()=>select(state));useAuthStore.getState=()=>state;`,
    '@/stores/profile.store': `export const useProfileStore={getState:()=>({activeProfileId:null})};`,
    '@/stores/chat.store': `window.__SENDS=[];const state={activeConversationId:'${conversationId}',sendMessage(value){window.__SENDS.push(value);return{accepted:true}}};export const useChatStore={getState:()=>state};`,
    sonner: `export const toast={success(){}};`,
  };
  const built = await build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{SecureConfigurationForm}from ${JSON.stringify(path.join(DASH, 'src/components/chat/SecureConfigurationForm.tsx'))};createRoot(document.getElementById('root')).render(<SecureConfigurationForm operationId="${operationId}" conversationId="${conversationId}"/>);`, resolveDir: DASH, sourcefile: 'commands-form-fixture.tsx', loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', nodePaths: [path.join(DASH, 'node_modules')],
    define: { 'import.meta.env.VITE_API_URL': '""', 'import.meta.env.VITE_MOCK_API': '"false"' },
    plugins: [{ name: 'closed-fixture-stores', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' };
        if (args.path.startsWith('@/')) return { path: path.join(DASH, 'src', args.path.slice(2)) + (['@/components/ui/button', '@/components/ui/input'].includes(args.path) ? '.tsx' : '.ts') };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], resolveDir: DASH, loader: 'ts' }));
    } }],
  });
  bundle = built.outputFiles[0].text;
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); });

test('private commands card preserves anyOf boolean/auto proposals and accepts their stored operation without string conversion', async t => {
  const expectedSchema = { anyOf: [{ type: 'boolean' }, { type: 'string', const: 'auto' }] };
  for (const key of ['native', 'nativeSkills']) {
    const input = z.toJSONSchema(commandsControlsSchema.shape[key]);
    assert.deepEqual(input.anyOf, expectedSchema.anyOf);
    assert.equal(Object.hasOwn(input, 'any_of'), false);
    for (const proposedValue of [true, false, 'auto']) {
      // Use the server's actual leaf validator; the form re-reads this typed proposal by ID.
      const validated = commandsControlsSchema.shape[key].parse(proposedValue);
      let operation = {
        kind: 'configuration_change_v1', change_id: operationId, credential_request_id: null,
        setting_id: `security.native_commands.${key}`, label: `Comandos nativos · ${key}`,
        state: 'human_action_required', human_action_required: true, scope: 'instance',
        proposed_value: validated, expires_at: '2099-01-01', activation: 'saved_configuration', result_code: null,
        consequences: ['Guardar no ejecuta comandos. Su activación queda pendiente.'],
      };
      const requests = [], denied = [], errors = [];
      const context = await browser.newContext();
      await context.addCookies([{ name: 'claw_session', value: 'synthetic-human-session', url: origin }]);
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) { denied.push(request.url()); return route.abort(); }
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><div id="root"></div><script src="/bundle.js"></script>' });
        if (url.pathname === '/bundle.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
        const humanSession = request.headers().cookie?.includes('claw_session=synthetic-human-session');
        if (!humanSession) { denied.push('missing-fixture-human-session'); return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN' } } }); }
        requests.push({ method: request.method(), path: url.pathname, query: url.search, body: request.postDataJSON() });
        if (request.method() === 'GET' && url.pathname === `/api/v1/configuration/credentials/${operationId}` && url.searchParams.get('conversation_id') === conversationId) {
          return route.fulfill({ json: { data: operation }, headers: { 'cache-control': 'no-store', 'x-skip-case-transform': '1' } });
        }
        if (request.method() === 'POST' && url.pathname === `/api/v1/configuration/changes/${operationId}/accept`) {
          operation = { ...operation, state: 'pending_activation' };
          return route.fulfill({ json: { data: operation }, headers: { 'cache-control': 'no-store', 'x-skip-case-transform': '1' } });
        }
        denied.push(url.pathname); return route.abort();
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(origin);
        await expect(page.getByRole('heading')).toHaveCount(0);
        await expect(page.locator('section strong')).toHaveText(`Comandos nativos · ${key}`);
        await expect(page.locator('section code')).toHaveText(JSON.stringify(proposedValue));
        assert.equal(await page.locator('input,select,textarea').count(), 0);
        await page.getByRole('button', { name: 'Aplicar y continuar', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Su activación todavía necesita comprobarse.');
        assert.equal(typeof operation.proposed_value, typeof proposedValue);
        assert.equal(operation.proposed_value, proposedValue);
        assert.deepEqual(requests, [
          { method: 'GET', path: `/api/v1/configuration/credentials/${operationId}`, query: `?conversation_id=${conversationId}`, body: null },
          { method: 'POST', path: `/api/v1/configuration/changes/${operationId}/accept`, query: '', body: {} },
        ]);
        const sends = await page.evaluate(() => window.__SENDS);
        assert.equal(sends.length, 1); assert.ok(sends[0].includes(operationId));
        assert.doesNotMatch(sends[0], /nativeSkills|security\.native_commands|Guardar no ejecuta|synthetic-human-session/);
        assert.deepEqual(denied, []); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  }
  t.diagnostic('6 browser flows: native/nativeSkills × true/false/auto; real card, conversation service and API client; only synthetic routed responses.');
});

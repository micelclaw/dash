// @ts-nocheck -- Browser fixture boundary; production modules are typechecked separately.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DASH = fileURLToPath(new URL('../../../', import.meta.url));
const CORE = path.join(path.dirname(DASH), 'micelclaw-os/core');
const { build } = await import(pathToFileURL(path.join(CORE, 'node_modules/esbuild/lib/main.js')).href);
const { chromium, expect } = await import(pathToFileURL(path.join(DASH, 'node_modules/@playwright/test/index.mjs')).href);
const operationId = '00000000-0000-4000-8000-000000000001';
const conversationId = '00000000-0000-4000-8000-000000000002';
let directory, bundle, browser;
before(async () => {
  await mkdir(path.resolve(DASH, '../_artifacts/scratch'), { recursive: true });
  directory = await mkdtemp(path.resolve(DASH, '../_artifacts/scratch/s10-chat-form-'));
  const entry = path.join(directory, 'entry.tsx');
  await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import{SecureConfigurationForm}from ${JSON.stringify(path.join(DASH, 'src/components/chat/SecureConfigurationForm.tsx'))};createRoot(document.getElementById('root')).render(<SecureConfigurationForm operationId="${operationId}" conversationId="${conversationId}"/>);`);
  const stubs = {
    '@/stores/auth.store': `import{useSyncExternalStore}from'react';const l=new Set();window.__auth={sessionGeneration:1};export const useAuthStore=s=>useSyncExternalStore(f=>{l.add(f);return()=>l.delete(f)},()=>s(window.__auth));useAuthStore.getState=()=>window.__auth;window.changeSession=()=>{window.__auth={sessionGeneration:2};for(const f of l)f()};`,
    '@/stores/chat.store': `window.__SENDS=[];const state={activeConversationId:'${conversationId}',sendMessage(value){window.__SENDS.push(value);return{accepted:true}}};export const useChatStore={getState:()=>state};`,
    '@/services/api': `async function call(method,p,body,options){const r=await fetch(p,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:options?.signal});const value=await r.json();if(!r.ok)throw Error('fixture-denied');return value}export const api={get:(p,q,o)=>call('GET',p+'?'+new URLSearchParams(q),null,o),post:(p,b,o)=>call('POST',p,b,o)};`,
    'sonner': `export const toast={success(){}};`,
  };
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', jsx: 'automatic', nodePaths: [path.join(DASH, 'node_modules')], plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => { if (args.path === './api' && args.importer.endsWith('/configuration-conversation.service.ts')) return { path: '@/services/api', namespace: 'stub' }; if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'stub' }; if (args.path.startsWith('@/')) return { path: path.join(DASH, 'src', args.path.slice(2)) + (args.path.endsWith('.ts') ? '' : ['@/components/ui/button', '@/components/ui/input'].includes(args.path) ? '.tsx' : '.ts') }; });
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], resolveDir: DASH, loader: 'ts' }));
  } }] });
  bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(!existsSync(chromium.executablePath()) && existsSync('/opt/google/chrome/chrome') ? { executablePath: '/opt/google/chrome/chrome' } : {}) });
});
after(async () => { await browser?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
async function fixture(t) {
  const state = { operation: { kind: 'configuration_change_v1', change_id: operationId, credential_request_id: operationId, setting_id: 'ai.api_keys.openai', label: 'API key · openai', state: 'waiting_for_credential', authentication: 'not_checked', human_action_required: false, expires_at: '2099-01-01', activation: 'saved_configuration', result_code: null }, bodies: [], outside: [], errors: [], deny: false };
  const send = (response, data, code = 200) => response.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(code === 200 ? { data } : { error: { code: 'NOT_FOUND' } }));
  const server = createServer((request, response) => {
    if (request.url === '/bundle.js') return response.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
    if(request.url===`/configuration/changes/${operationId}/accept`&&request.method==='POST'){
      let body='';request.on('data',chunk=>{body+=chunk;});request.on('end',()=>{state.bodies.push(JSON.parse(body));state.operation.state='pending_activation';send(response,state.operation);});return;
    }
    if (request.url.startsWith('/configuration/credentials/')) {
      if (request.method === 'GET') return send(response, state.operation, state.deny ? 404 : 200);
      let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => {
        state.bodies.push(JSON.parse(body)); state.operation.state = request.url.endsWith('/cancel') ? 'cancelled' : 'saved'; send(response, state.operation);
      }); return;
    }
    if (request.url === '/favicon.ico') return response.writeHead(204).end();
    response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext(); await context.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); state.outside.push(route.request().url()); return route.abort(); });
  const page = await context.newPage(); page.on('pageerror', error => state.errors.push(error.message));
  t.after(async () => { await context.close(); await new Promise(resolve => server.close(resolve)); assert.deepEqual(state.outside, []); assert.deepEqual(state.errors, []); });
  await page.goto(origin); await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
  return { state, page, origin };
}
test('secure chat form sends the value only to private endpoint and resumes with opaque result; reload recovers saved status', async t => {
  const f = await fixture(t); const value = 'fixture-private-api-key';
  const field = f.page.getByLabel('API key', { exact: true }); assert.equal(await field.getAttribute('type'), 'password');
  await field.fill(value); await f.page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(f.page.getByRole('status')).toContainText('Credencial guardada y releída');
  assert.deepEqual(f.state.bodies, [{ conversation_id: conversationId, value }]);
  const sends = await f.page.evaluate(() => window.__SENDS); assert.equal(sends.length, 1); assert.equal(sends.join('').includes(value), false); assert.ok(sends[0].includes(operationId));
  assert.equal((await f.page.locator('body').innerText()).includes(value), false);
  await f.page.reload(); await expect(f.page.getByRole('status')).toContainText('autenticación externa todavía no'); assert.equal(await f.page.locator('input[type="password"]').count(), 0);
});
test('cancel clears the field without submitting its value, and a new session cannot retain an old form', async t => {
  const f = await fixture(t); await f.page.getByLabel('API key', { exact: true }).fill('fixture-must-not-submit');
  await f.page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(f.page.getByRole('status')).toContainText('cancelada');
  assert.deepEqual(f.state.bodies, [{ conversation_id: conversationId }]); assert.deepEqual(await f.page.evaluate(() => window.__SENDS), []);
  f.state.operation.state = 'waiting_for_credential'; await f.page.reload(); await f.page.getByLabel('API key', { exact: true }).fill('fixture-cleared-on-logout'); f.state.deny = true;
  await f.page.evaluate(() => window.changeSession()); await expect(f.page.getByRole('status')).toContainText('no está disponible'); assert.equal(await f.page.locator('input[type="password"]').count(), 0);
});

test('human global proposal shows fixed consequences and requested scalar on the same card, then reports pending without exposing them to chat',async t=>{
 const f=await fixture(t);f.state.operation={...f.state.operation,setting_id:'tools.profile',label:'Herramientas · perfil global',state:'human_action_required',human_action_required:true,credential_request_id:null,scope:'instance',proposed_value:'coding',consequences:['Se desvincula el perfil con nombre activo.','Se conservan las listas de herramientas permitidas y bloqueadas.']};await f.page.reload();
 await expect(f.page.getByText('Consecuencias del cambio',{exact:true})).toBeVisible();await expect(f.page.getByText('Se desvincula el perfil con nombre activo.',{exact:true})).toBeVisible();await expect(f.page.getByText('Valor propuesto:',{exact:false})).toContainText('coding');assert.equal(await f.page.locator('input[type="password"]').count(),0);
 await f.page.getByRole('button',{name:'Aplicar y continuar',exact:true}).click();await expect(f.page.getByRole('status')).toContainText('Configuración guardada y releída');assert.deepEqual(f.state.bodies,[{}]);const messages=await f.page.evaluate(()=>window.__SENDS);assert.equal(messages.length,1);assert.ok(messages[0].includes(operationId));assert.doesNotMatch(messages.join(''),/coding|perfil con nombre activo/);
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [req.resolve('vite')] }));
const revision = 'a'.repeat(64);
const fixtureSource = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigurationMigrationSection } from './src/components/settings/sections/ConfigurationMigrationSection';
import { useAuthStore } from '@/stores/auth.store';
import { useConfigurationStore } from '@/stores/configuration.store';
import { useConfigurationAvailabilityStore } from '@/stores/configuration-availability.store';
const revision = '${revision}';
const catalog = scope => ({format_version:1,blocks:[{id:'appearance_preferences',label:'Preferencias',authorized:true,available:true}],coverage:{complete:scope==='instance',issues:[]},export:{scope,available:true}});
const fixture = window.readableFixture = {
  calls: [], created: [], revoked: [], downloads: [], toasts: [], pending: [], response: null,
  async apiGet(url, query) {
    this.calls.push({method:'GET',url});
    if(url==='/configuration/catalog') return {data:catalog(query.scope)};
    if(url==='/configuration/snapshot') return {data:{revision,scope:query.scope,generated_at:'2026-11-18T00:00:00Z',warnings:[]}};
    if(url==='/configuration/imports/current') return {data:null};
    if(url==='/configuration/recovery') return {data:[{id:'recovery-fixture',scope:'personal',created_at:'2026-11-18T00:00:00Z',blocks:['appearance_preferences'],limitations:[]}]};
    throw Error('Unclassified fixture GET');
  },
  async apiPost(url, body) {
    this.calls.push({method:'POST',url,body,inputs:Array.from(document.querySelectorAll('input[type=password]'), input=>input.value)});
    if(url==='/configuration/export') return new Promise(resolve=>this.pending.push(result=>{this.response=result;resolve({data:result})}));
    if(url==='/configuration/recovery/recovery-fixture/open') return {data:{id:'recovered',scope:'personal',status:'draft',created_at:'2026-11-18T00:00:00Z',updated_at:'2026-11-18T00:00:00Z',preview:null,results:[]}};
    throw Error('Unclassified fixture POST');
  },
  resolve(result) { const next=this.pending.shift(); if(!next)throw Error('No pending export'); next(result); },
  change(kind) {
    const auth=useAuthStore.getState();
    if(kind==='account')useAuthStore.setState({user:{...auth.user,id:'another-fixture'}});
    else if(kind==='generation')useAuthStore.setState({sessionGeneration:auth.sessionGeneration+1});
    else if(kind==='role')useAuthStore.setState({user:{...auth.user,role:'user'}});
    else if(kind==='auth')useAuthStore.setState({isAuthenticated:false});
    else if(kind==='logout')useAuthStore.setState({logoutState:'revoking'});
    else if(kind==='scope')useConfigurationStore.setState({scope:'instance',catalog:catalog('instance')});
    else if(kind==='selection')useConfigurationStore.getState().select('appearance_preferences',false);
    else if(kind==='availability')useConfigurationAvailabilityStore.setState({status:'unavailable'});
    else if(kind==='readiness')useConfigurationStore.setState({catalog:{...catalog('personal'),export:{scope:'personal',available:false}}});
    else if(kind==='block-authority')useConfigurationStore.setState({catalog:{...catalog('personal'),blocks:catalog('personal').blocks.map(block=>({...block,authorized:false}))}});
    else if(kind==='block-availability')useConfigurationStore.setState({catalog:{...catalog('personal'),blocks:catalog('personal').blocks.map(block=>({...block,available:false}))}});
    else if(kind==='unmount')mounted.unmount();
    else throw Error('Unknown fixture change');
  },
  allowFormTransition() { useConfigurationStore.setState({busy:false}); },
};
URL.createObjectURL = blob => {const url='blob:readable-fixture/'+fixture.created.length;fixture.created.push({url,blob});return url};
URL.revokeObjectURL = url => fixture.revoked.push(url);
HTMLAnchorElement.prototype.click = function() {const item=fixture.created.find(item=>item.url===this.href);if(!item)throw Error('Unclassified download');fixture.downloads.push({filename:this.download,type:item.blob.type,text:()=>item.blob.text()})};
window.fetch=()=>{throw Error('Live network forbidden')};
useConfigurationAvailabilityStore.setState({sessionKey:'fixture-owner:19',status:'available'});
const mounted=createRoot(document.getElementById('app'));
mounted.render(React.createElement(ConfigurationMigrationSection));
`;
const built = await esbuild.build({
  stdin: { contents: fixtureSource, resolveDir: root, sourcefile: 'readable-fixture.tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', tsconfig: path.join(root, 'tsconfig.app.json'),
  plugins: [{ name: 'readable-closed-ports', setup(builder) {
    builder.onResolve({ filter: /^@\/stores\/auth.store$|^\.\/auth.store$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/stores\/ui-preferences.store$/ }, () => ({ path: 'preferences', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/services\/api$|^\.\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /^sonner$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: root, contents:
      args.path === 'auth' ? `import {create} from 'zustand';export const useAuthStore=create(()=>({user:{id:'fixture-owner',role:'owner'},sessionGeneration:19,isAuthenticated:true,logoutState:'idle'}));`
        : args.path === 'preferences' ? `export const useUiPreferencesStore=()=>({ready:false,legacy:null,error:null,saving:false});`
          : args.path === 'toast' ? `export const toast={success:message=>window.readableFixture.toasts.push(message),error:message=>window.readableFixture.toasts.push(message)};`
            : `export class ApiError extends Error{};export const api={get:(...args)=>window.readableFixture.apiGet(...args),post:(...args)=>window.readableFixture.apiPost(...args)};` }));
  } }],
});
const browser = await chromium.launch({ headless: true, ...(process.env.CLAW_CHROMIUM_PATH ? { executablePath: process.env.CLAW_CHROMIUM_PATH } : {}) });
after(() => browser.close());

function result(scope = 'personal') {
  const content = `${JSON.stringify({format:'micelclaw-configuration-readable',version:1,scope,export_revision:revision,blocks:{appearance_preferences:{adapters:{'user.calendar':{version:1,value:{literal:'  Íntegro\n'+'x'.repeat(20_000),nullable:null,zero:0,enabled:false}}}}},coverage:{selected_capture_complete:true,instance_complete:false,limitations:['Captura seleccionada','Configurado no acredita activo','JSON de consulta; importar .micelcfg']}} ,null,2)}\n`;
  return {filename:`micelclaw-configuration-v1-${revision.slice(0,12)}.micelcfg`,file:'synthetic-encrypted-file\nEXACT\u00e1',warnings:[],readable:{available:true,filename:`micelclaw-configuration-v1-${revision.slice(0,12)}-readable.json`,media_type:'application/json',content,revision}};
}
async function environment() {
  const page = await browser.newPage(), errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { network.push(route.request().url()); return route.abort(); });
  await page.setContent('<div id="app"></div>');
  await page.addScriptTag({content:built.outputFiles[0].text});
  await page.getByRole('button',{name:'Exportar configuración',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('button[aria-label="Actualizar configuración"]').disabled);
  return {page,errors,network,async close(){await page.close();assert.deepEqual(errors,[]);assert.deepEqual(network,[])}};
}
async function submit(page, scope = 'personal') {
  if(scope==='instance') {await page.getByLabel('Ámbito').selectOption('instance');await page.waitForFunction(()=>!document.querySelector('button[aria-label="Actualizar configuración"]').disabled)}
  await page.getByRole('button',{name:'Exportar configuración',exact:true}).click();
  await page.locator('#configuration-export-password').fill('fixture-archive-password');
  await page.locator('#configuration-export-confirmation').fill('fixture-archive-password');
  if(scope==='instance')await page.locator('#configuration-reauth').fill('fixture-reauth-password');
  const before=await page.evaluate(()=>window.readableFixture.calls.length);
  await page.getByRole('button',{name:'Descargar archivo cifrado',exact:true}).click();
  await page.waitForFunction(()=>window.readableFixture.pending.length===1);
  assert.equal(await page.locator('input[type=password]').evaluateAll(inputs=>inputs.every(input=>input.value==='')),true);
  return before;
}
const downloads = page => page.evaluate(()=>Promise.all(window.readableFixture.downloads.map(async item=>({filename:item.filename,type:item.type,text:await item.text()}))));

test('one real component export clears credentials before IO and downloads both exact response files without another GET', {timeout:30_000}, async()=>{
  const f=await environment();
  try {
    const before=await submit(f.page,'instance'), response=result('instance');
    const sent=await f.page.evaluate(()=>window.readableFixture.calls.at(-1));
    assert.equal(sent.url,'/configuration/export');assert.equal(sent.body.scope,'instance');
    assert.equal(sent.body.password,'fixture-archive-password');assert.equal(sent.body.reauth_password,'fixture-reauth-password');
    assert.deepEqual(sent.inputs,['','','']);
    await f.page.evaluate(value=>window.readableFixture.resolve(value),response);
    await f.page.getByRole('button',{name:'Descargar ajustes legibles .json',exact:true}).click();
    assert.deepEqual(await downloads(f.page),[
      {filename:response.filename,type:'application/octet-stream',text:response.file},
      {filename:response.readable.filename,type:'application/json',text:response.readable.content},
    ]);
    assert.equal(await f.page.evaluate(()=>window.readableFixture.calls.length),before+1);
    // A changed full revision sharing the same filename prefix cannot borrow
    // the stored capture's authority on a later click.
    await f.page.evaluate(()=>{window.readableFixture.response.readable.revision='a'.repeat(12)+'b'.repeat(52)});
    await f.page.getByRole('button',{name:'Descargar ajustes legibles .json',exact:true}).click();
    assert.equal((await downloads(f.page)).length,2);
    await f.page.waitForFunction(()=>new Set(window.readableFixture.revoked).size===2);
  } finally {await f.close()}
});

test('legacy missing, unavailable and mismatched views keep the encrypted export without partial plaintext or a second request', {timeout:30_000}, async()=>{
  for(const kind of ['legacy','unavailable','mismatched-revision','mismatched-file']) {
    const f=await environment();
    try {
      const before=await submit(f.page), response=result();
      if(kind==='legacy')delete response.readable;
      if(kind==='unavailable')response.readable={available:false,revision,issues:[{code:'CONFIGURATION_READABLE_EXPORT_UNAVAILABLE',message:'Falta clasificación completa de la selección.'}]};
      if(kind==='mismatched-revision')response.readable.content=response.readable.content.replace(revision,'a'.repeat(12)+'b'.repeat(52));
      if(kind==='mismatched-file')response.readable.filename='different-readable.json';
      await f.page.evaluate(value=>window.readableFixture.resolve(value),response);
      await f.page.getByTestId('configuration-readable-export').waitFor();
      assert.equal(await f.page.getByRole('button',{name:'Descargar ajustes legibles .json',exact:true}).count(),0);
      assert.deepEqual(await downloads(f.page),[{filename:response.filename,type:'application/octet-stream',text:response.file}]);
      if(kind==='unavailable')await f.page.getByText('Falta clasificación completa de la selección.',{exact:true}).waitFor();
      assert.equal(await f.page.evaluate(()=>window.readableFixture.calls.length),before+1);
    } finally {await f.close()}
  }
});

test('late export responses after identity, role, scope, readiness or form transitions never create a Blob', {timeout:60_000}, async()=>{
  for(const kind of ['account','generation','role','auth','logout','scope','selection','availability','readiness','block-authority','block-availability','cancel','import','begin','recovery','unmount']) {
    const f=await environment();
    try {
      await submit(f.page);
      if(['cancel','import','begin','recovery'].includes(kind)) {
        // Exercise the existing UI handlers while the synthetic API is still
        // pending; the store fixture releases only its busy presentation flag.
        await f.page.evaluate(()=>window.readableFixture.allowFormTransition());
        if(kind==='cancel')await f.page.getByRole('button',{name:'Volver',exact:true}).click();
        if(kind==='import')await f.page.getByRole('button',{name:'Importar archivo',exact:true}).click();
        if(kind==='begin')await f.page.getByRole('button',{name:'Exportar configuración',exact:true}).click();
        if(kind==='recovery')await f.page.getByRole('button',{name:'Preparar recuperación',exact:true}).click();
      } else await f.page.evaluate(value=>window.readableFixture.change(value),kind);
      await f.page.evaluate(value=>window.readableFixture.resolve(value),result());
      // Let the old promise and any React cleanup settle before inspecting
      // the actual Blob side-effect port, including unmount.
      await f.page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,25)));
      assert.equal(await f.page.evaluate(()=>window.readableFixture.created.length),0,kind);
      assert.equal(await f.page.getByTestId('configuration-readable-export').count(),0,kind);
    } finally {await f.close()}
  }
});

test('a retained readable result is discarded on authorization or availability downgrade in the same generation', {timeout:30_000}, async()=>{
  for(const kind of ['role','auth','availability','readiness','block-authority','block-availability']) {
    const f=await environment();
    try {
      await submit(f.page);await f.page.evaluate(value=>window.readableFixture.resolve(value),result());
      await f.page.getByRole('button',{name:'Descargar ajustes legibles .json',exact:true}).waitFor();
      await f.page.evaluate(value=>window.readableFixture.change(value),kind);
      await f.page.waitForFunction(()=>!document.querySelector('[data-testid="configuration-readable-export"]'));
      assert.equal(await f.page.evaluate(()=>window.readableFixture.created.length),1,kind);
      assert.equal(await f.page.evaluate(()=>window.readableFixture.revoked.length>0),true,kind);
    } finally {await f.close()}
  }
});

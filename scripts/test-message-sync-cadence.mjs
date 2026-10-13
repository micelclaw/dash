// UI y servicios productivos; solo HTTP, sesión y vecinos fuera de DSC6 simulados.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dash = fileURLToPath(new URL('../', import.meta.url));
const requireDash = createRequire(`${dash}package.json`);
const esbuild = createRequire(requireDash.resolve('vite'))('esbuild');
const { chromium, expect } = requireDash('@playwright/test');
const stubs = {
  '@/stores/auth.store': 'export const useAuthStore={getState:()=>({tokens:null})};',
  '@/stores/profile.store': 'export const useProfileStore={getState:()=>({activeProfileId:null})};',
  '@/hooks/use-websocket': `import {useEffect,useState} from 'react';export function useWebSocket(){const [e,set]=useState(null);useEffect(()=>{const fn=e=>set(e.detail);window.addEventListener('fixture-sync',fn);return()=>window.removeEventListener('fixture-sync',fn)},[]);return e;}`,
  'sonner': `const emit=(kind,message)=>{window.__toasts.push({kind,message})};export const toast={success:m=>emit('success',m),error:m=>emit('error',m),info:m=>emit('info',m)};`,
  '@/components/shared/platform-icons': 'export const PlatformIcon=()=>null;',
  './MessageBubble': 'export const MessageBubble=()=>null;',
  './ComposeBar': 'export const ComposeBar=()=> <div>Composer conservado</div>;',
  './ChatGallery': 'export const ChatGallery=()=> <div>Galería conservada</div>;',
};
const bundle = await esbuild.build({
  stdin: { contents: `import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router';import {MessageThread} from './src/modules/messages/MessageThread';import {getConnectorSyncSchedule} from './src/services/sync.service';
    const root=createRoot(document.getElementById('root'));window.__toasts=[];window.getSchedule=getConnectorSyncSchedule;
    window.mount=(platform='discord',id='connector',extra={})=>root.render(<MemoryRouter><MessageThread channelId={id} channelName="Fixture chat" platform={platform} capability={{platform,transport:'native',can_observe:true,stream:'not_applicable',connector:{id,status:'active',errors_count:0,last_sync_at:null},...extra}} messages={[]} loading={false} loadingOlder={false} hasMore={false} error={null} onLoadOlder={()=>{}} onSend={async()=>{}} sending={false}/></MemoryRouter>);
    window.mount();`, resolveDir: dash, loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  tsconfig: `${dash}tsconfig.app.json`,
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env.VITE_API_URL': '""', 'import.meta.env.VITE_MOCK_API': '"false"' },
  plugins: [{ name: 'offline-boundaries', setup(build) {
    build.onResolve({ filter: /.*/ }, args => stubs[args.path] ? {path:args.path,namespace:'fixture'} : undefined);
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({contents:stubs[args.path],loader:'jsx',resolveDir:dash}));
  }}],
});
let scenario, calls, release;
const reset = (extra={}) => { scenario={direction:'pull',status:'connected',interval:15,action:'sync_started',...extra};calls=[]; };
reset();
const browser = await chromium.launch({headless:true});
let count=0;
try {
  const page=await browser.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/app.js"></script>'});
    const path=url.pathname,method=route.request().method();calls.push({method,path});
    let data;
    if(path==='/api/v1/sync/connectors')data=['connector','other'].map(id=>({id,direction:scenario.direction}));
    else if(path.endsWith('/run')) {
      if(scenario.holdPost)await new Promise(resolve=>{release=resolve});
      if(scenario.postError)return route.fulfill({status:scenario.postError,json:{error:{code:'CONFLICT',message:'Fixture failure'}}});
      data=scenario.action===null?{}:{action:scenario.action};
    } else {
      const snapshot={status:scenario.status,last_sync_at:'2026-09-28T12:00:00Z',config:{sync_interval_minutes:scenario.interval,unrelated:'not retained'}};
      if(scenario.holdGet && path.endsWith('/connector'))await new Promise(resolve=>{release=resolve});
      if(scenario.getError)return route.fulfill({status:500,json:{error:{code:'TEST',message:'Fixture failure'}}});
      data=snapshot;
    }
    return route.fulfill({json:{data}});
  });
  const open=async(extra={})=>{reset(extra);await page.goto('http://fixture.test/');};
  const button=()=>page.getByRole('button',{name:'Sincronizar ahora',exact:true});
  const ready=async()=>{await button().waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Sincronización del canal"]')?.textContent.includes('Última sincronización'));};
  const emit=async(id='connector')=>page.evaluate(id=>window.dispatchEvent(new CustomEvent('fixture-sync',{detail:{event:'sync.completed',data:{connector_id:id,created:0,updated:0}}})),id);
  const test=async(name,fn)=>{await fn();count++;console.log(`PASS ${count}: ${name}`);};

  await test('Discord, Slack y ambas Session: intervalo real, última sync, hilo cableado y galería conservada',async()=>{
    await open();await ready();
    for(const platform of ['discord','slack','session','session_link']){
      await page.evaluate(p=>window.mount(p),platform);
      assert.match(await page.getByRole('region',{name:'Sincronización del canal'}).textContent(),/cada 15 min.*No es tiempo real/s);
    }
    await page.getByRole('button',{name:'Galería del chat'}).click();await page.getByText('Galería conservada').waitFor();
    assert.equal(await button().count(),1);
    const projection=await page.evaluate(()=>window.getSchedule('connector'));
    assert.deepEqual(projection,{status:'connected',interval_minutes:15,last_sync_at:'2026-09-28T12:00:00Z'});
    assert.ok(calls.some(c=>c.path==='/api/v1/sync/connectors/connector'));
  });
  await test('Cadencia no inventada: otros intervalos y ausente/cero/negativo/string/null',async()=>{
    for(const interval of [3,undefined,0,-1,'15',null]){
      await open({interval});await ready();
      const text=await page.getByRole('region',{name:'Sincronización del canal'}).textContent();
      assert.ok(text.includes(interval===3?'cada 3 min':'intervalo no disponible'));
    }
  });
  await test('Push sin stream no muestra periodicidad ni solicita detalle; stream/sin conector no hace peticiones',async()=>{
    await open({direction:'push'});await page.waitForTimeout(150);
    assert.equal(await button().count(),0);assert.equal(calls.filter(c=>c.path.endsWith('/connector')).length,0);
    calls=[];await page.evaluate(()=>window.mount('signal','other',{stream:'connected'}));await page.waitForTimeout(100);assert.equal(calls.length,0);
    await page.evaluate(()=>window.mount('discord','other',{connector:null}));assert.equal(await button().count(),0);
  });
  await test('Pausa, pairing y syncing bloquean; error permite reintento manual',async()=>{
    for(const status of ['paused','pending_pairing','syncing','error']){
      await open({status});await ready();assert.equal(await button().isDisabled(),status!=='error');
    }
  });
  await test('Capabilities reales durante syncing: can_observe=false/status=null no oculta barra; completed sin cambios la recupera',async()=>{
    await open({status:'syncing'});await ready();
    await page.evaluate(()=>window.mount('discord','connector',{can_observe:false,connector:{id:'connector',status:null}}));
    assert.equal(await button().isDisabled(),true);
    assert.ok(await page.getByText(/Sincronización en curso/).isVisible());
    scenario.status='connected';await emit();await expect(button()).toBeEnabled();
  });
  await test('GET fallido: mensaje + reintento recupera sin falsa cadencia',async()=>{
    await open({getError:true});await page.getByText('No se pudo consultar la sincronización.').waitFor();
    assert.equal(await button().count(),0);scenario.getError=false;
    await page.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(button()).toBeEnabled();
  });
  await test('POST diferido: doble clic no duplica; 202 no es acabado y GET connected no reactiva; evento cero registros sí libera',async()=>{
    await open({holdPost:true});await ready();
    await button().click();await page.waitForFunction(()=>document.querySelector('[aria-label="Sincronización del canal"]')?.textContent.includes('Solicitando'));
    await page.getByRole('button',{name:'Solicitando…',exact:true}).evaluate(el=>el.click());
    assert.equal(calls.filter(c=>c.method==='POST').length,1);release();
    await page.getByRole('button',{name:'Sincronización solicitada…',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Sincronización solicitada…',exact:true}).isDisabled(),true);
    assert.match((await page.evaluate(()=>window.__toasts))[0].message,/solicitada/);
    await emit('other');assert.equal(await button().count(),0);
    await emit();await expect(button()).toBeEnabled();
  });
  await test('Fallback de polling: syncing→connected libera; timeout pendiente informa sin afirmar finalización',async()=>{
    await open();await ready();await button().click();await page.getByRole('button',{name:'Sincronización solicitada…',exact:true}).waitFor();
    scenario.status='syncing';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText(/Sincronización en curso/).waitFor();
    scenario.status='connected';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(button()).toBeEnabled();
    await button().click();await page.getByRole('button',{name:'Sincronización solicitada…',exact:true}).waitFor();
    await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+31_000;window.dispatchEvent(new Event('focus'))});await expect(button()).toBeEnabled();
    assert.ok((await page.evaluate(()=>window.__toasts)).some(t=>t.kind==='info'&&t.message.includes('no se ha confirmado')));
  });
  await test('Evento de fin antes de resolver el POST no deja solicitud bloqueada',async()=>{
    await open({holdPost:true});await ready();await button().click();
    await page.getByRole('button',{name:'Solicitando…',exact:true}).waitFor();
    await emit();await page.waitForTimeout(50);release();
    await page.waitForFunction(()=>window.__toasts.length>0);await expect(button()).toBeEnabled();
  });
  await test('409/500 y respuesta action ausente/desconocida no producen falso éxito',async()=>{
    for(const extra of [{postError:409},{postError:500},{action:null},{action:'unknown'}]){
      await open(extra);await ready();await button().click();await page.waitForFunction(()=>window.__toasts.length>0);
      assert.equal((await page.evaluate(()=>window.__toasts))[0].kind,'error');
    }
  });
  await test('Feedback exacto para noop/stream/refreshed, sin éxito sync ficticio',async()=>{
    for(const [action,text]of [['noop','no hay nada'],['stream_already_live','ya está conectado'],['stream_reconnected','Reconexión solicitada'],['refreshed','Actualización solicitada']]){
      await open({action});await ready();await button().click();await page.waitForFunction(()=>window.__toasts.length>0);
      assert.ok((await page.evaluate(()=>window.__toasts))[0].message.includes(text));
    }
  });
  await test('GET tardío del conector anterior no sobrescribe nuevo chat; POST tardío no muestra toast del anterior',async()=>{
    await open({holdGet:true});await page.waitForTimeout(150);
    scenario.interval=7;await page.evaluate(()=>window.mount('slack','other'));await ready();
    const done=release;scenario.holdGet=false;done();await page.waitForTimeout(100);
    await expect(page.getByRole('region',{name:'Sincronización del canal'})).toContainText('cada 7 min');
    scenario.holdPost=true;await button().click();await page.waitForTimeout(100);
    const finish=release;await page.evaluate(()=>window.mount('signal','other',{stream:'connected'}));finish();await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(()=>window.__toasts),[]);
  });
  assert.deepEqual(errors,[]);
  console.log(`${count}/${count} escenarios UI/cliente reales. HTTP/sesión/WS simulados; sin proveedor vivo ni build Vite.`);
} finally { if(release)release();await browser.close(); }

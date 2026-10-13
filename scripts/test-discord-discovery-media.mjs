import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dash=fileURLToPath(new URL('../',import.meta.url));
const req=createRequire(`${dash}package.json`);
const esbuild=createRequire(req.resolve('vite'))('esbuild');
const {chromium,expect}=req('@playwright/test');
const stubs={
  '@/stores/auth.store':'export const useAuthStore={getState:()=>({tokens:null})}',
  '@/stores/profile.store':'export const useProfileStore={getState:()=>({activeProfileId:null})}',
  sonner:`export const toast={success:m=>window.__toasts.push(m),error:m=>window.__toasts.push(m)};`,
};
const bundle=await esbuild.build({
  stdin:{contents:`import{createRoot}from'react-dom/client';import{DiscordBotForm}from'./src/components/settings/add-integration/DiscordBotForm';import{MessageBubble}from'./src/modules/messages/MessageBubble';import{ChatGallery}from'./src/modules/messages/ChatGallery';
    const root=createRoot(document.getElementById('root'));window.__toasts=[];window.__complete=0;
    window.mountForm=()=>root.render(<DiscordBotForm onCancel={()=>{}} onComplete={()=>{window.__complete++}}/>);
    window.mountMedia=message=>root.render(<><MessageBubble message={message}/><ChatGallery channelId="111111111111111111"/></>);window.mountForm();`,resolveDir:dash,loader:'tsx'},
  bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',tsconfig:`${dash}tsconfig.app.json`,
  define:{'process.env.NODE_ENV':'"test"','import.meta.env.VITE_API_URL':'""','import.meta.env.VITE_MOCK_API':'"false"'},
  plugins:[{name:'fixture-session-only',setup(build){
    build.onResolve({filter:/.*/},a=>stubs[a.path]?{path:a.path,namespace:'fixture'}:undefined);
    build.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js',resolveDir:dash}));
  }}],
});
const g1='444444444444444444',g2='555555555555555555';
const a1='333333333333333333';
let scenario,calls,release;
const reset=extra=>{scenario={guilds:[{id:g1,name:'Fixture one'}],has_more:false,...extra};calls=[];};reset();
const browser=await chromium.launch({headless:true});let count=0;
try{
  const page=await browser.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/app.js"></script>'});
    calls.push({method:request.method(),path:url.pathname,body:request.postDataJSON(),kind:url.searchParams.get('kind')});
    if(url.pathname==='/api/v1/sync/discord/guilds'){
      const data={guilds:scenario.guilds,has_more:scenario.has_more};
      if(scenario.hold)await new Promise(resolve=>{release=resolve});
      if(scenario.error)return route.fulfill({status:502,json:{error:{code:'DISCORD_REQUEST_FAILED',message:'Fixture failure'}}});
      return route.fulfill({json:{data}});
    }
    if(url.pathname==='/api/v1/sync/connectors')return route.fulfill({json:{data:{id:'fixture-connector'}}});
    if(url.pathname==='/api/v1/messages')return route.fulfill({json:{data:[scenario.message],meta:{total:1,limit:100,offset:0}}});
    if(url.pathname.startsWith('/api/v1/messages/media/discord/'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j65cAAAAASUVORK5CYII=','base64')});
    return route.abort();
  });
  const open=async(extra={})=>{reset(extra);await page.goto('http://fixture.test/');};
  const fill=async()=>{
    await page.getByLabel('Bot Token',{exact:true}).fill('fixture-not-a-credential');
    await page.getByLabel('Your Discord user ID',{exact:true}).fill('666666666666666666');
  };
  const find=()=>page.getByRole('button',{name:'Buscar servidores',exact:true});
  const connect=()=>page.getByRole('button',{name:'Connect',exact:true});
  const test=async(name,fn)=>{await fn();console.log(`PASS ${++count}: ${name}`);};
  await test('Formulario/cliente real: uno se autoselecciona y alta conserva guild/token/owner sin token en URL',async()=>{
    await open();await fill();assert.equal(await connect().isDisabled(),true);
    await find().click();await expect(page.getByRole('combobox',{name:'Servidor'})).toHaveText('Fixture one');await expect(connect()).toBeEnabled();
    await connect().click();await page.waitForFunction(()=>window.__complete===1);
    assert.deepEqual(calls.find(c=>c.path==='/api/v1/sync/connectors').body,{connector_type:'discord-observer',config:{bot_token:'fixture-not-a-credential',guild_id:g1,owner_discord_user_id:'666666666666666666'}});
    assert.ok(calls.every(c=>!c.path.includes('fixture-not-a-credential')));
  });
  await test('Varios requieren elección explícita; owner sigue obligatorio',async()=>{
    await open({guilds:[{id:g1,name:'Fixture one'},{id:g2,name:'Fixture two'}]});await fill();await find().click();
    await page.getByRole('combobox',{name:'Servidor'}).waitFor();assert.equal(await connect().isDisabled(),true);
    await page.getByRole('combobox',{name:'Servidor'}).click();await page.getByRole('option',{name:'Fixture two',exact:true}).click();
    await expect(connect()).toBeEnabled();await page.getByLabel('Your Discord user ID',{exact:true}).fill('username');await expect(connect()).toBeDisabled();
    await page.getByLabel('Your Discord user ID',{exact:true}).fill('666666666666666666');await connect().click();await page.waitForFunction(()=>window.__complete===1);
    assert.equal(calls.find(c=>c.path==='/api/v1/sync/connectors').body.config.guild_id,g2);
  });
  await test('DIR4 formulario real bloquea owner vacío/malformado y envía string exacto con trim',async()=>{
    await open();await fill();await find().click();await page.getByRole('combobox',{name:'Servidor'}).waitFor();
    const owner=page.getByLabel('Your Discord user ID',{exact:true});
    for(const value of ['', 'username', '1234567890123456', '123456789012345678901', '１２３４５６７８９０１２３４５６７８']){
      await owner.fill(value);await expect(connect()).toBeDisabled();
      await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      assert.equal(calls.filter(c=>c.path==='/api/v1/sync/connectors').length,0);
    }
    await owner.fill(' 12345678901234567890 ');await expect(connect()).toBeEnabled();
    await connect().click();await page.waitForFunction(()=>window.__complete===1);
    assert.equal(calls.find(c=>c.path==='/api/v1/sync/connectors').body.config.owner_discord_user_id,'12345678901234567890');
  });
  await test('Vacío/error/parcial y alternativa manual no eliminan puerta de alta',async()=>{
    await open({guilds:[]});await fill();await find().click();await page.getByText(/El bot no está en ningún servidor/).waitFor();await expect(connect()).toBeDisabled();
    await page.getByRole('button',{name:'Introducir Server ID manualmente'}).click();await page.getByLabel('Server (Guild) ID',{exact:true}).fill(g2);await expect(connect()).toBeEnabled();
    await open({error:true});await fill();await find().click();await page.getByText(/No se pudo consultar Discord/).waitFor();assert.equal((await page.evaluate(()=>window.__toasts)).length,1);
    scenario.error=false;scenario.has_more=true;await find().click();await page.getByText(/La lista es parcial/).waitFor();await expect(connect()).toBeDisabled();
  });
  await test('Token nuevo invalida selección y GET tardío; doble búsqueda en vuelo no duplica',async()=>{
    await open({hold:true});await fill();await find().click();await page.getByRole('button',{name:'Buscando servidores…'}).waitFor();
    await page.getByRole('button',{name:'Buscando servidores…'}).evaluate(b=>b.click());assert.equal(calls.length,1);
    await page.getByLabel('Bot Token',{exact:true}).fill('fixture-new');const old=release;scenario.hold=false;old();
    await expect(page.getByRole('combobox',{name:'Servidor'})).toHaveCount(0);await expect(connect()).toBeDisabled();
    scenario.guilds=[{id:g2,name:'New server'}];await find().click();await expect(page.getByRole('combobox',{name:'Servidor'})).toHaveText('New server');
    await page.getByLabel('Bot Token',{exact:true}).fill('fixture-next');await expect(page.getByRole('combobox',{name:'Servidor'})).toHaveCount(0);
  });
  await test('Burbuja y Gallery reales muestran imagen/vídeo/PDF/audio mixtos con URLs proxy y PNG visible',async()=>{
    await open();const base=`/api/v1/messages/media/discord/`;
    scenario.message={id:'mixed',platform:'discord',direction:'received',sender_name:'Fixture peer',sent_at:'2026-09-28T12:00:00Z',content:'Mixed message',content_type:'image',
      attachments:[{id:a1,kind:'image',mime_type:'image/png',name:'Picture',size_bytes:3,url:base+a1,thumbnail_url:null},
        {id:'333333333333333336',kind:'video',mime_type:'video/mp4',name:'Fixture video',url:base+'333333333333333336',thumbnail_url:null},
        {id:'333333333333333334',kind:'file',mime_type:'application/octet-stream',name:'Fixture.pdf',url:base+'333333333333333334',thumbnail_url:null},
        {id:'333333333333333335',kind:'audio',mime_type:'audio/ogg',name:'Voice',url:base+'333333333333333335',thumbnail_url:null}]};
    await page.evaluate(message=>window.mountMedia(message),scenario.message);
    await page.getByAltText('Picture').first().waitFor();await page.waitForFunction(()=>[...document.images].some(i=>i.alt==='Picture'&&i.complete&&i.naturalWidth===1));
    await expect(page.getByAltText('Picture')).toHaveCount(2);
    await expect(page.locator('video')).toHaveCount(2);
    await expect(page.locator('video[aria-label="Fixture video"]')).toHaveAttribute('src',base+'333333333333333336');
    assert.ok((await page.getByAltText('Picture').first().getAttribute('src')).startsWith('/api/v1/messages/media/discord/'));
    await page.getByRole('button',{name:'Files',exact:true}).click();await expect(page.getByRole('link',{name:'Fixture.pdf',exact:true})).toHaveCount(2);
    await page.getByRole('button',{name:'Voice',exact:true}).click();await expect(page.locator('audio')).toHaveCount(2);
    assert.ok(calls.some(c=>c.kind==='media'));assert.ok(calls.some(c=>c.kind==='files'));assert.ok(calls.some(c=>c.kind==='voice'));
  });
  assert.deepEqual(errors,[]);console.log(`${count}/${count} escenarios UI/cliente reales; red/sesión simuladas, sin Discord vivo.`);
}finally{if(release)release();await browser.close();}

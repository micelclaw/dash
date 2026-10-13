import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dash=fileURLToPath(new URL('../',import.meta.url)),req=createRequire(`${dash}package.json`);
const esbuild=createRequire(req.resolve('vite'))('esbuild');const {chromium,expect}=req('@playwright/test');
const stubs={'@/stores/auth.store':'export const useAuthStore={getState:()=>({tokens:null})}',
  '@/stores/profile.store':'export const useProfileStore={getState:()=>({activeProfileId:null})}'};
const bundle=await esbuild.build({stdin:{contents:`import{createRoot}from'react-dom/client';import{MessageBubble}from'./src/modules/messages/MessageBubble';import{ChatGallery}from'./src/modules/messages/ChatGallery';
  const root=createRoot(document.getElementById('root'));window.mount=message=>root.render(<><MessageBubble message={message}/><ChatGallery key={message.platform} channelId={message.platform_channel_id}/></>);`,resolveDir:dash,loader:'tsx'},
  bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',tsconfig:`${dash}tsconfig.app.json`,
  define:{'process.env.NODE_ENV':'"test"','import.meta.env.VITE_API_URL':'""','import.meta.env.VITE_MOCK_API':'"false"'},
  plugins:[{name:'fixture-identity',setup(b){b.onResolve({filter:/.*/},a=>stubs[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js',resolveDir:dash}));}}]});
const cid='11111111-1111-4111-8111-111111111111';
let message,calls=[],mode='success',count=0;const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/app.js"></script>'});
    calls.push({path:url.pathname,kind:url.searchParams.get('kind'),channel:url.searchParams.get('channel_id')});
    if(url.pathname==='/api/v1/messages')return mode==='error'?route.fulfill({status:502,json:{error:{code:'FIXTURE_ERROR',message:'Unavailable'}}}):route.fulfill({json:{data:mode==='empty'?[]:[message],meta:{total:mode==='empty'?0:1}}});
    if(url.pathname.startsWith('/api/v1/messages/media/'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j65cAAAAASUVORK5CYII=','base64')});
    return route.abort();
  });
  const run=async(name,fn)=>{await fn();console.log(`PASS ${++count}: ${name}`);};
  const open=async()=>{await page.goto('http://fixture.test/');await page.evaluate(m=>window.mount(m),message);};
  for(const platform of ['slack','matrix']){
    const base=platform==='slack'?`/api/v1/messages/media/slack/${cid}~F012345678`:'/api/v1/messages/media/micelclaw.local/fixture-';
    message={id:`fixture-${platform}`,platform,platform_channel_id:platform==='slack'?'C0123456789':'!matrix-fixture:micelclaw.local',direction:'sent',content:'Mixed fixture',content_type:'image',sent_at:'2026-09-28T12:00:00Z',read_at:null,
      attachments:[{id:'image',kind:'image',mime_type:'image/png',name:'Picture',url:base+'9',thumbnail_url:platform==='matrix'?base+'9?w=320':null},
        {id:'video',kind:'video',mime_type:'video/mp4',name:'Fixture video',url:base+'A',thumbnail_url:null},
        {id:'file',kind:'file',mime_type:'application/octet-stream',name:'Fixture.pdf',url:base+'B',thumbnail_url:null},
        {id:'audio',kind:'audio',mime_type:'audio/ogg',name:'Voice',url:base+'C',thumbnail_url:null}]};
    mode='success';calls=[];
    await run(`${platform}: burbuja/Gallery reales, PNG cargado y URLs proxy sin proveedor`,async()=>{
      await open();await expect(page.getByAltText('Picture')).toHaveCount(2);await page.waitForFunction(()=>[...document.images].filter(i=>i.alt==='Picture').every(i=>i.complete&&i.naturalWidth===1));
      await expect(page.locator('video')).toHaveCount(2);await expect(page.getByLabel('Enviado')).toHaveCount(1);await expect(page.getByLabel('Leído')).toHaveCount(0);
      assert.ok(calls.some(c=>c.kind==='media'&&c.channel===message.platform_channel_id));
      assert.ok((await page.getByAltText('Picture').first().getAttribute('src')).startsWith('/api/v1/messages/media/'));
      await page.getByRole('button',{name:'Files',exact:true}).click();await expect(page.getByRole('link',{name:'Fixture.pdf',exact:true})).toHaveCount(2);
      await page.getByRole('button',{name:'Voice',exact:true}).click();await expect(page.locator('audio')).toHaveCount(2);
      assert.ok(calls.some(c=>c.kind==='files'));assert.ok(calls.some(c=>c.kind==='voice'));
    });
    await run(`${platform}: recarga restaura adjuntos; read_at pinta azul solo al recibirlo`,async()=>{
      if(platform==='matrix')message={...message,read_at:'2026-09-28T12:01:00Z'};
      await open();await expect(page.getByAltText('Picture')).toHaveCount(2);
      await expect(page.getByLabel(platform==='matrix'?'Leído':'Enviado')).toHaveCount(1);
    });
    await run(`${platform}: vacío/error de galería conserva burbuja sin romper UI`,async()=>{
      for(const next of ['empty','error']){mode=next;await open();await page.getByText('No media',{exact:true}).waitFor();await expect(page.getByAltText('Picture')).toHaveCount(1);}
    });
  }
  assert.deepEqual(errors,[]);console.log(`${count}/${count} UI reales, red/sesión fixture; PNG visible, no playback ni proveedor vivo.`);
}finally{await browser.close();}

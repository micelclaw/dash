import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(path.join(root,'micelclaw-os/core/package.json'));
const {build}=require('esbuild'),{chromium}=createRequire(path.join(root,'dash/package.json'))('@playwright/test');
const tmp=await mkdtemp(path.join(os.tmpdir(),'s01-slack-ui-'));
let server,browser;const results=[],calls=[];
const own='dd4d75fb-0000-4000-8000-000000000026';
let ready=false,rows=[],failJoin=false;
const caps=()=>({prepared:ready,reason:ready?null:'Guard nativo pendiente',can_prepare:false,account_busy:rows.some(r=>r.status!=='closed'),modes:['transcribe','agent','bidi'],memory_between_meetings:false,workshop_eligible:false});
try{
 await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{SlackChannelTabs}from'./src/components/settings/slack-meetings/SlackChannelTabs';function Test(){const[supported,setSupported]=React.useState(false);return <><button onClick={()=>setSupported(v=>!v)}>Actualizar capacidad Core fixture</button><SlackChannelTabs supported={supported} messages={<div>Mensajes Slack: OAuth desconectado</div>}/></>}createRoot(document.getElementById('root')).render(<Test/>);`,resolveDir:path.join(root,'dash'),loader:'tsx'},outfile:path.join(tmp,'bundle.js'),bundle:true,format:'iife',platform:'browser',jsx:'automatic',tsconfig:path.join(root,'dash/tsconfig.app.json'),plugins:[{name:'explicit-normal-actor-and-conversation-fixtures',setup(b){
  b.onResolve({filter:/stores\/(auth|profile|chat)\.store$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.includes('auth.store')?`export const useAuthStore={getState:()=>({tokens:null,sessionGeneration:1,logoutState:'idle'})};`:args.path.includes('profile.store')?`export const useProfileStore={getState:()=>({activeProfileId:null})};`:`const state={conversations:[{id:'own-conversation',first_message:'Reunión de Paco',access:'owner'},{id:'foreign-conversation',first_message:'Privada de otro usuario',access:'viewer'}],loadConversations:()=>Promise.resolve()};export const useChatStore=selector=>selector(state);` }));
 } }],define:{'import.meta.env.VITE_API_URL':'""','import.meta.env.VITE_MOCK_API':'"false"'}});
 server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');return;}
  if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(tmp,'bundle.js')));return;}
  calls.push({method:req.method,path:url.pathname});res.setHeader('Content-Type','application/json');let body='';for await(const chunk of req)body+=chunk;
  if(url.pathname.endsWith('/capabilities'))res.end(JSON.stringify({data:caps()}));
  else if(url.pathname==='/api/v1/slack-meetings'&&req.method==='GET')res.end(JSON.stringify({data:rows}));
  else if(url.pathname==='/api/v1/slack-meetings'&&req.method==='POST'){
   const input=JSON.parse(body);assert.equal(input.conversation_id,'own-conversation');assert.equal(input.capture_acknowledged,true);assert.equal(input.agent_id,undefined);assert.ok(input.operation_id);
   if(failJoin){res.statusCode=503;res.end(JSON.stringify({error:{code:'QA_TRANSIENT',message:'Fallo transitorio reproducido'}}));}
   else{const row={id:crypto.randomUUID(),user_id:own,conversation_id:input.conversation_id,huddle_url:input.huddle_url,mode:input.mode,status:'active',failure_code:null};rows=[row];res.end(JSON.stringify({data:row}));}
  }else if(url.pathname.endsWith('/leave')){rows=rows.map(r=>({...r,status:'closed'}));res.end(JSON.stringify({data:{closed:true}}));}
  else if(req.method==='GET'&&url.pathname.startsWith('/api/v1/slack-meetings/')){res.end(JSON.stringify({data:{meeting:rows[0],native:{found:true,session:{id:'fixture-native-session',state:'active',chrome:{health:{in_call:true,mic_muted:true}}}}}}));}
  else{res.statusCode=404;res.end(JSON.stringify({error:{code:'NOT_FOUND'}}));}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE??'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1200,height:900}});await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByText('Mensajes Slack: OAuth desconectado').waitFor();assert.equal(await page.getByRole('tab',{name:'Reuniones',exact:true}).count(),0);assert.equal(calls.length,0);
 await page.getByRole('button',{name:'Actualizar capacidad Core fixture'}).click();await page.getByRole('tab',{name:'Reuniones',exact:true}).click();results.push('actual Slack tabs require Core advertisement, independently from messaging OAuth; absent capability makes no meetings request');
 await page.getByRole('status').filter({hasText:'Pendiente'}).waitFor();assert.equal(await page.getByRole('button',{name:'Entrar',exact:true}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Verificar preparación dedicada'}).count(),0);results.push('normal Paco sees unavailable guard and no administrative preparation');
 ready=true;await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('status').filter({hasText:'Lista'}).waitFor();
 await page.getByLabel('Conversación propia de origen').click();assert.equal(await page.getByRole('option',{name:'Privada de otro usuario'}).count(),0);await page.getByRole('option',{name:'Reunión de Paco'}).click();
 await page.getByLabel('Enlace de un Huddle ya iniciado').fill('https://app.slack.com/huddle/T0123ABCD/C0123ABCD');await page.getByRole('checkbox').check();
 failJoin=true;await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('alert').filter({hasText:'Fallo transitorio reproducido'}).waitFor();assert.equal(await page.getByLabel('Enlace de un Huddle ya iniciado').inputValue(),'https://app.slack.com/huddle/T0123ABCD/C0123ABCD');results.push('own conversation only; transient failure remains visible and form is retained');
 failJoin=false;await page.getByLabel('Modo').click();await page.getByRole('option',{name:'Voz agente',exact:true}).click();await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByText('Sesión vinculada',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Actualizar reunión y transcripción'}).count(),0);assert.equal(calls.filter(c=>c.path.includes('/transcript')).length,0);results.push('real UI and API create linked voice mapping without claiming or fetching captions');
 await page.reload();await page.getByRole('button',{name:'Actualizar capacidad Core fixture'}).click();await page.getByRole('tab',{name:'Reuniones',exact:true}).click();await page.getByText('Sesión vinculada',{exact:true}).waitFor();results.push('reload restores durable server mapping without repeating join');
 await page.getByRole('button',{name:'Actualizar reunión',exact:true}).click();await page.getByRole('status').filter({hasText:'Micrófono silenciado'}).waitFor();assert.equal(calls.filter(c=>c.path.includes('/transcript')).length,0);results.push('native observed microphone state is visible without claiming heard audio or requesting voice captions');
 await page.getByRole('button',{name:'Salir y confirmar cierre'}).click();await page.getByText('Cerrada',{exact:true}).waitFor();results.push('close reflects confirmation and releases busy account');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'_artifacts/screenshots/inbox/s01-p2-slack-390.png'),fullPage:true});assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({status:'PASS',cases:results.length,results,scope:'actual component and typed API; synthetic backend/readiness/identity; not Slack, native guard or product acceptance',browser:'headless',calls: calls.length},null,2));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await rm(tmp,{recursive:true,force:true});}

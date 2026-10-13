import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {api} from '@/services/api';
import type {ApiResponse} from '@/types/api';
import type {Note} from '@/types/notes';

/** Same title input and structured writer; this hook is not a separate editor. */
export function useNotionTitle(note:Note|null,hasBodyPending:()=>boolean,blockBody:RefObject<boolean>,onConfirmed:(note:Note)=>void){
 const active=['notion-notes','nextcloud-notes'].includes(note?.sync?.provider??'');
 const providerLabel=note?.sync?.provider==='nextcloud-notes'?'Nextcloud':'Notion';
 const eligible=Boolean(note&&active&&note.sync?.owner&&note.sync.title_certified&&note.sync.remote_editable!==false&&note.sync.state==='synced'&&note._shared_permission!=='read');
 const session=useRef<{id:string;baseline:string;draft:string;revision:string}|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),busy=useRef(false),mounted=useRef(true);
 const[version,setVersion]=useState(0),[saving,setSaving]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const body=useRef(hasBodyPending);body.current=hasBodyPending;
 const confirm=useRef(onConfirmed);confirm.current=onConfirmed;
 const allowed=useRef(eligible);allowed.current=eligible;
 const rerender=()=>setVersion(value=>value+1);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);};},[]);
 useEffect(()=>{
  if(!active||!note){session.current=null;blockBody.current=false;return;}
  const state=session.current;
  if(state?.id===note.id&&state.baseline===(note.title??'')&&state.revision===note.sync?.local_revision)return;
  if(state?.id===note.id&&(busy.current||state.draft!==state.baseline))return;
  if(timer.current)clearTimeout(timer.current);
  session.current={id:note.id,baseline:note.title??'',draft:note.title??'',revision:note.sync?.local_revision??''};
  busy.current=false;blockBody.current=false;setSaving(false);setError('');setStatus('');rerender();
 },[active,note?.id,note?.title,note?.sync?.local_revision,blockBody]);
 const flushRef=useRef<()=>Promise<void>>(async()=>{});
 const flush=useCallback(async()=>{
  const state=session.current;
  if(!state||busy.current||state.draft===state.baseline||!allowed.current||body.current())return;
  const submitted=state.draft;busy.current=true;blockBody.current=true;setSaving(true);setError('');
  try{
   await api.post(`/notes/${state.id}/sync-edit`,{expected_local_revision:state.revision,operations:[{op:'set_title',title:submitted}]},{timeout:150000});
   const sync=await api.get<ApiResponse<{state:string}>>(`/notes/${state.id}/sync-state`);
   if(sync.data.state!=='synced')throw new Error(`${providerLabel} no ha confirmado el título. Tu borrador se conserva.`);
   const fresh=await api.get<ApiResponse<Note>>(`/notes/${state.id}`);
   if(session.current!==state||!mounted.current)return;
   if (((fresh.data.title ?? '') !== submitted && providerLabel !== 'Nextcloud') || !fresh.data.sync?.local_revision)
    throw new Error('La lectura no confirmó el título. Tu borrador se conserva.');
   state.baseline=fresh.data.title??'';state.revision=fresh.data.sync.local_revision;
   if(state.draft===submitted)state.draft=state.baseline;
   confirm.current(fresh.data);setStatus(`Título guardado en ${providerLabel}.`);
  }catch(reason){
   if(session.current===state&&mounted.current)setError(reason instanceof Error?reason.message:'No se pudo guardar el título. Tu borrador se conserva.');
   return; // Never retry an uncertain write automatically.
  }finally{
   if(session.current===state){busy.current=false;blockBody.current=state.draft!==state.baseline;if(mounted.current){setSaving(false);rerender();}}
  }
  if(session.current===state&&state.draft!==state.baseline)timer.current=setTimeout(()=>void flushRef.current(),1200);
 },[blockBody,providerLabel]);flushRef.current=flush;
 const onChange=useCallback((title:string)=>{
  const state=session.current;if(!state||!allowed.current||body.current())return;
  state.draft=title;blockBody.current=state.draft!==state.baseline||busy.current;setError('');setStatus('');rerender();
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flushRef.current(),1200);
 },[blockBody]);
 const discard=useCallback(async()=>{
  const state=session.current;if(!state||busy.current)return;
  if(timer.current)clearTimeout(timer.current);busy.current=true;blockBody.current=true;setSaving(true);
  try{
   const fresh=await api.get<ApiResponse<Note>>(`/notes/${state.id}`);
   if(session.current!==state||!mounted.current)return;
   state.baseline=fresh.data.title??'';state.draft=state.baseline;state.revision=fresh.data.sync?.local_revision??'';
   confirm.current(fresh.data);setError('');setStatus('');
  }catch{if(session.current===state&&mounted.current)setError('No se pudo refrescar la nota. Tu borrador se conserva.');}
  finally{if(session.current===state){busy.current=false;blockBody.current=state.draft!==state.baseline;if(mounted.current){setSaving(false);rerender();}}}
 },[blockBody]);
 const current=session.current?.id===note?.id?session.current:null;
 void version;
 return {active,enabled:eligible&&Boolean(current)&&!hasBodyPending(),title:current?.draft??note?.title??'',dirty:Boolean(current&&current.draft!==current.baseline),saving,error,status,onChange,discard};
}

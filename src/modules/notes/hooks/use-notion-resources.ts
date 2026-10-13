import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {api} from '@/services/api';
import {useAuthStore} from '@/stores/auth.store';
import type {ApiResponse} from '@/types/api';
import type {Note} from '@/types/notes';
interface ResourceRequest{file_id:string;expected_local_revision:string;idempotency_key:string;mode:'append'|'replace';target_id:string|null;}
interface Intent{owner:string;note_id:string;input:ResourceRequest;}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Resource action for the existing NoteEditor. Never inserts an optimistic
 * local image into connected content; only the confirmed native projection does.
 */
export function useNotionResources(note:Note|null,blocked:()=>boolean,onConfirmed:(note:Note)=>void){
 const owner=useAuthStore(state=>state.user?.id),key=owner&&note?`notes-resource-intent:${owner}:${note.id}`:'';
 const identity=useRef(key),confirm=useRef(onConfirmed),hasDraft=useRef(blocked);
 useLayoutEffect(()=>{identity.current=key;confirm.current=onConfirmed;hasDraft.current=blocked;},[key,onConfirmed,blocked]);
 const[pending,setPending]=useState<Intent|null>(null),[restored,setRestored]=useState(''),[working,setWorking]=useState('');
 const[error,setError]=useState(''),[status,setStatus]=useState('');
 const[recoveryFailed,setRecoveryFailed]=useState('');
 const inFlight=useRef<string|null>(null),mounted=useRef(false);
 const active=note?.sync?.provider==='notion-notes'||note?.sync?.provider==='nextcloud-notes';
 const providerName=note?.sync?.provider==='nextcloud-notes'?'Nextcloud':'Notion';
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let live=true;
  queueMicrotask(()=>{
   if(!live)return;setError('');setStatus('');setRecoveryFailed('');let intent:Intent|null=null;
   try{const raw=key?sessionStorage.getItem(key):null;
    if(raw){const value=JSON.parse(raw) as Intent,input=value.input;
     if(value.owner!==owner||value.note_id!==note?.id||!input||![input.file_id,input.expected_local_revision,input.idempotency_key].every(id=>uuid.test(id))||
      !['append','replace'].includes(input.mode)||(input.mode==='replace'?!input.target_id||!uuid.test(input.target_id):input.target_id!==null))throw new Error('Solicitud de adjunto pendiente no válida.');
     intent=value;
     setError('Hay un adjunto pendiente de confirmación. Comprueba la misma solicitud antes de añadir otro.');
    }
   }catch{setRecoveryFailed(key);setError('No se pudo recuperar la solicitud de adjunto. No se enviará otra automáticamente.');}
   setPending(intent);setRestored(key);
  });
  return()=>{live=false;};
 },[key,owner,note?.id]);
 const intent=pending&&pending.owner===owner&&pending.note_id===note?.id?pending:null;
 const sending=Boolean(key)&&working===key;
 const busy=sending||Boolean(intent)||Boolean(key&&recoveryFailed===key);
 const enabled=Boolean(active&&note?.sync?.owner&&note.sync.resource_certified&&note.sync.state==='synced'&&note.sync.local_revision&&
  !note._shared_permission&&restored===key&&!busy&&!blocked());
 const send=useCallback(async(saved:Intent)=>{
  if(!key||saved.owner!==owner||saved.note_id!==note?.id||inFlight.current===key)return;
  inFlight.current=key;setWorking(key);setError('');setStatus(`Confirmando el archivo en ${providerName}…`);
  try{
   const response=await api.post<ApiResponse<Note>>(`/notes/${saved.note_id}/sync-resource`,saved.input,{timeout:150000});
   if(!mounted.current||identity.current!==key)return;
   if(response.data.id!==saved.note_id||response.data.sync?.state!=='synced')throw new Error('El adjunto sigue pendiente de confirmación. Conservamos la misma solicitud.');
   sessionStorage.removeItem(key);setPending(null);confirm.current(response.data);setStatus(`Archivo guardado en ${providerName}.`);
  }catch{if(mounted.current&&identity.current===key){setError('No se ha confirmado el adjunto. Comprueba la misma solicitud; no elijas otro archivo para repetirla.');setStatus('');}}
  finally{if(inFlight.current===key)inFlight.current=null;if(mounted.current&&identity.current===key)setWorking('');}
 },[key,owner,note?.id,providerName]);
 const upload=useCallback(async(file:File,targetId:string|null=null)=>{
  if(!enabled||!owner||!note?.sync?.local_revision||hasDraft.current()||inFlight.current===key)return;
  const maxBytes=providerName==='Nextcloud'?25*1024*1024:20*1024*1024;
  if((targetId&&providerName==='Nextcloud')||!file.size||file.size>maxBytes||!['image/png','image/jpeg','image/gif','image/webp','application/pdf'].includes(file.type)){
   setError(providerName==='Nextcloud'?'Elige una imagen PNG/JPEG/GIF/WebP o PDF de hasta 25 MB para añadir.':'Elige una imagen PNG/JPEG/GIF/WebP o PDF de hasta 20 MB. Notion puede aplicar un límite menor.');return;
  }
  inFlight.current=key;setWorking(key);setError('');setStatus('Preparando el archivo…');
  try{
   const form=new FormData();form.append('file',file);form.append('parent_folder',`/drive/notes-uploads/${note.id}/`);form.append('on_conflict','rename');
   const uploaded=await api.upload<ApiResponse<{id:string}>>('/files/upload',form,'POST',{timeout:60000});
   if(!mounted.current||identity.current!==key)return;
   if(!uuid.test(uploaded.data.id))throw new Error('El archivo local no se ha confirmado.');
   const saved:Intent={owner,note_id:note.id,input:{file_id:uploaded.data.id,expected_local_revision:note.sync.local_revision,
    idempotency_key:crypto.randomUUID(),mode:targetId?'replace':'append',target_id:targetId}};
   sessionStorage.setItem(key,JSON.stringify(saved));setPending(saved);inFlight.current=null;
   await send(saved);
  }catch{if(mounted.current&&identity.current===key){setError(`No se pudo preparar el adjunto. No se ha enviado una nueva solicitud a ${providerName}.`);setStatus('');}}
  finally{if(inFlight.current===key)inFlight.current=null;if(mounted.current&&identity.current===key)setWorking('');}
 },[enabled,owner,note,key,send,providerName]);
 const retry=useCallback(async()=>{
  if(intent&&note?.sync?.owner&&note.sync.resource_certified&&!['paused','unavailable','conflict'].includes(note.sync.state)&&!hasDraft.current())await send(intent);
 },[intent,note,send]);
 return {active,enabled,busy,sending,error,status,upload,retry,pending:Boolean(intent)};
}

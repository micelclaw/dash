import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useAuthStore} from '@/stores/auth.store';
import {useInitialSetupStore} from '@/stores/initial-setup.store';
import * as sync from '@/services/sync.service';
import {CollectionsEditor} from '@/components/settings/connect/CollectionsEditor';
const rank=(t:sync.ConnectorTypeMeta)=>t.domains.includes('emails')?0:t.domains.includes('contacts')?1:t.domains.includes('events')?2:t.domains.includes('tasks')?3:4;
export function GroupedIntegrations({onRefresh,onBusy,pending=[]}:{onRefresh:()=>void;onBusy?:(value:boolean)=>void;pending?:sync.ConnectorInfo[]}){
 const {progress,save}=useInitialSetupStore();const userId=useAuthStore(s=>s.user?.id),generation=useAuthStore(s=>s.sessionGeneration);
 const [types,setTypes]=useState<sync.ConnectorTypeMeta[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [collections,setCollections]=useState<Array<{id:string;connector_type:string;status:string}>>([]),[index,setIndex]=useState(0),[saving,setSaving]=useState(false);
 const collectionId=useRef<string|null>(null);collectionId.current=collections[index]?.id??null;
 const active=useRef<{id:string;controller:AbortController;popup:Window|null}|null>(null);const mounted=useRef(true);
 const current=()=>mounted.current&&useAuthStore.getState().user?.id===userId&&useAuthStore.getState().sessionGeneration===generation;
 useEffect(()=>{mounted.current=true;void sync.listDataCatalog().then(c=>{if(current())setTypes(c.connectorTypes.filter(t=>['google','microsoft'].includes(t.oauth_provider??'')&&t.oauth_scopes.length>0).sort((a,b)=>rank(a)-rank(b)));}).catch(()=>{if(current())setError('No se pudo leer el catálogo de integraciones.');});return()=>{mounted.current=false;const a=active.current;active.current=null;a?.controller.abort();a?.popup?.close();if(a?.id)void sync.cancelDirectOAuth(a.id).catch(()=>{});localStorage.removeItem('claw_oauth_pending');};},[userId,generation]);
 const selectionKeys=(t:sync.ConnectorTypeMeta)=>[`${t.oauth_provider}:${t.type}`,...t.domains.map(d=>`${t.oauth_provider}:${d==='emails'?'mail':d==='events'?'calendar':d}`)];
 const isSelected=(t:sync.ConnectorTypeMeta)=>selectionKeys(t).some(key=>progress.selections.includes(key));
 const selected=(provider:string)=>types.filter(t=>t.oauth_provider===provider&&isSelected(t));
 async function authorize(provider:string){
  const selection=selected(provider);if(!selection.length)return;
  const popup=window.open('about:blank','micelclaw-oauth-group','width=600,height=720,scrollbars=yes,resizable=yes');
  if(!popup){setError('Permite la ventana de autorización y vuelve a intentarlo.');return;}
  const controller=new AbortController();const a={id:'',controller,popup};active.current=a;setBusy(true);setError('');
  try{
   const flow=await sync.startGroupedOAuth(provider,selection.map(t=>t.type),selection.flatMap(t=>t.oauth_scopes),controller.signal,'local');
   if(!current()||active.current!==a){void sync.cancelDirectOAuth(flow.operation.id).catch(()=>{});return;}
   a.id=flow.operation.id;if(!flow.authorize_url)throw new Error('La autorización no devolvió una dirección.');
   localStorage.setItem('claw_oauth_pending',JSON.stringify({operation_id:a.id,provider,target_origin:window.location.origin}));if(popup&&flow.authorize_url){const authUrl=new URL(flow.authorize_url);if(authUrl.protocol!=='https:'&&authUrl.protocol!=='http:')throw new Error('Dirección de autorización no válida');popup.location.href=authUrl.href;}
   const result=await sync.pollDirectOAuth(a.id,controller.signal);
   if(!current()||active.current!==a)return;
   const rows=result.connectors;if(!rows||rows.length!==selection.length)throw new Error('No se confirmó toda la selección. Revisa las conexiones observadas; no repitas las ya creadas.');
   if(rows.some(r=>!selection.some(t=>t.type===r.connector_type)||!['connected','paused'].includes(r.status)))throw new Error('La selección guardada no está lista. Actualiza las conexiones observadas.');
   setCollections(rows);setIndex(0);setSaving(false);onRefresh();
  }catch(e){if(current())onRefresh();if(current()&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'No se completó la autorización.');}
  finally{if(active.current===a){active.current=null;popup?.close();localStorage.removeItem('claw_oauth_pending');if(current())setBusy(false);}}
 }
 function cancel(){const a=active.current;active.current=null;a?.controller.abort();a?.popup?.close();if(a?.id)void sync.cancelDirectOAuth(a.id).catch(()=>{});localStorage.removeItem('claw_oauth_pending');setBusy(false);setError('Cancelación solicitada; actualiza las conexiones para comprobar el resultado. Los permisos externos ya concedidos no se revocan automáticamente; revisa las conexiones observadas.');}
 function advance(){setSaving(false);if(index===collections.length-1){setCollections([]);setIndex(0);}else setIndex(i=>i+1);onRefresh();}
 const row=collections[index];
 useEffect(()=>{onBusy?.(busy||!!row);return()=>onBusy?.(false);},[busy,row,onBusy]);
 return <div className="space-y-4"><p>Una autorización por cuenta y proveedor incluye los permisos de todos los servicios seleccionados. Después eliges sus colecciones, paso a paso. Las conexiones nuevas permanecen pausadas hasta confirmar la selección.</p>
 {['google','microsoft'].map(provider=><fieldset className="border rounded p-3 space-y-2" key={provider} disabled={busy||collections.length>0}><legend>{provider==='google'?'Google':'Microsoft'}</legend><div className="flex flex-wrap gap-4">{types.filter(t=>t.oauth_provider===provider).map(t=>{const key=`${provider}:${t.type}`;return <label className="inline-flex gap-2" key={key}><input type="checkbox" checked={isSelected(t)} onChange={e=>save({selections:e.target.checked?[...progress.selections,key]:progress.selections.filter(s=>!selectionKeys(t).includes(s))})}/>{t.label}</label>;})}</div><Button disabled={!selected(provider).length||busy} onClick={()=>void authorize(provider)}>Autorizar {provider==='google'?'Google':'Microsoft'} una vez</Button></fieldset>)}
 {busy&&<p role="status">Esperando la autorización de la cuenta… <Button variant="outline" onClick={cancel}>Cancelar autorización</Button></p>}
 {!row&&!busy&&pending.length>0&&<Button variant="outline" onClick={()=>{setCollections(pending.map(c=>({id:c.id,connector_type:c.connector_type,status:c.status})));setIndex(0);setSaving(false);}}>Retomar selección pendiente ({pending.length})</Button>}
 {row&&<section className="border rounded p-4 space-y-3"><h3>Selección de colecciones — paso {index+1} de {collections.length}: {types.find(t=>t.type===row.connector_type)?.label??row.connector_type}</h3><CollectionsEditor key={row.id} connectorId={row.id} connectorType={row.connector_type} autoLoad continueLabel={index===collections.length-1?'Terminar selección':'Siguiente'} onSaving={value=>{if(collectionId.current===row.id)setSaving(value);}} onSaved={()=>{if(collectionId.current===row.id){advance();}}}/>
 <Button variant="ghost" disabled={saving} onClick={advance}>{row.status==='connected'?'Omitir cambios; conservar selección anterior':'Omitir selección; conservar pausada'}</Button></section>}
 {error&&<p role="alert">{error}</p>}</div>;
}

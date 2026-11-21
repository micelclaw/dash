import {useEffect,useState,useCallback,type ReactNode} from 'react';
import {Link,useNavigate} from 'react-router';
import {CheckCircle2,Clock3,AlertCircle,ExternalLink} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useSignOut} from '@/hooks/use-sign-out';
import {useAuthStore} from '@/stores/auth.store';
import {useSettingsStore} from '@/stores/settings.store';
import {useInitialSetupStore} from '@/stores/initial-setup.store';
import {GeneralSection} from '@/components/settings/sections/GeneralSection';
import {UsersAndGroupsSection} from '@/components/settings/sections/users-groups/UsersAndGroupsSection';
import {ConnectedList} from '@/components/settings/connect/ConnectedList';
import {CollectionsEditor} from '@/components/settings/connect/CollectionsEditor';
import * as sync from '@/services/sync.service';
import {listUsers} from '@/services/users.service';
import {api} from '@/services/api';
import {confirmInitialSession} from '@/services/initial-setup.service';
import {ApplicationsStep} from './ApplicationsStep';
import {GroupedIntegrations} from './GroupedIntegrations';
import {DemoAccount} from './DemoAccount';
import {LocalDomainStep} from './LocalDomainStep';
import {ensureOwnerGroupMembership} from './owner-groups';
import {steps,type SetupStep} from './progress';
const labels:Record<SetupStep,string>={domain:'Dominio local',preferences:'Preferencias',users:'Usuarios',integrations:'Integraciones',applications:'Aplicaciones',summary:'Resumen'};
function Card({title,state,children}:{title:string;state:'ok'|'pending'|'error';children:ReactNode}){
 const Icon=state==='ok'?CheckCircle2:state==='error'?AlertCircle:Clock3;
 return <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3"><h3 className="flex items-center gap-2 font-semibold"><Icon size={18} className={state==='ok'?'text-green-400':state==='error'?'text-red-400':'text-amber-400'}/>{title}</h3><div className="space-y-2 text-sm">{children}</div></section>;
}
export function Component(){
 const user=useAuthStore(s=>s.user);const navigate=useNavigate();const {signOut,revoking:signingOut,error:signOutError}=useSignOut();
 const {progress,load,save,storageError,progressConflict,agents,agentsError,prepareAgents}=useInitialSetupStore();
 const settings=useSettingsStore(s=>s.settings),savedSettings=useSettingsStore(s=>s.original),settingsError=useSettingsStore(s=>s.error);
 const [confirmedId,setConfirmedId]=useState<string|null>(null),[sessionError,setSessionError]=useState<string|null>(null),[sessionRetry,setSessionRetry]=useState(0);
 const [domainRefreshVersion,setDomainRefreshVersion]=useState(0),[domain,setDomain]=useState<{operational:boolean;url:string|null}|null>(null);
 const [connectors,setConnectors]=useState<sync.ConnectorInfo[]|null>(null),[usersCount,setUsersCount]=useState<number|null>(null);
 const [groupStatus,setGroupStatus]=useState<string|null>(null),[groupError,setGroupError]=useState<string|null>(null);
 const [errors,setErrors]=useState<string[]>([]),[busy,setBusy]=useState(false),[finishing,setFinishing]=useState(false),[integrationsBusy,setIntegrationsBusy]=useState(false),[editing,setEditing]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
  const session=useAuthStore.getState();if(session.user?.role!=='owner')return;const id=session.user.id,gen=session.sessionGeneration;setBusy(true);
  const result=await Promise.allSettled([sync.listConnectors(),listUsers(),api.get<{data:{operational:boolean;url:string|null}}>('/initial-setup/local-access')]);
  if(useAuthStore.getState().user?.id!==id||useAuthStore.getState().sessionGeneration!==gen)return;
  const[c,u,d]=result;setConnectors(c.status==='fulfilled'?c.value:null);setUsersCount(u.status==='fulfilled'?u.value.length:null);setDomain(d.status==='fulfilled'?d.value.data:null);
  setErrors(result.flatMap((r,i)=>r.status==='rejected'?[`${['Integraciones','Usuarios','Acceso local'][i]}: ${r.reason instanceof Error?r.reason.message:'No disponible'}`]:[]));setBusy(false);
 },[]);
 useEffect(()=>{
  if(user?.role!=='owner')return;let cancelled=false;setConfirmedId(null);setSessionError(null);setGroupError(null);
  const gen=useAuthStore.getState().sessionGeneration;
  void(async()=>{try{const current=await confirmInitialSession();if(cancelled)return;if(current.id!==user.id||current.role!=='owner')throw new Error('Inicia sesión de nuevo con el propietario de esta instalación.');await load(current.id);if(cancelled)return;setConfirmedId(current.id);
   void ensureOwnerGroupMembership(current).then(()=>{if(!cancelled&&useAuthStore.getState().sessionGeneration===gen)setGroupStatus('Administradores y Usuarios');}).catch(e=>{if(!cancelled)setGroupError(e instanceof Error?e.message:'Pertenencia a grupos pendiente');});
   void api.post('/initial-setup/demo',{}).catch(()=>{});void useSettingsStore.getState().fetchSettings();void refresh();
  }catch(e){if(!cancelled)setSessionError(e instanceof Error?e.message:'No se pudo confirmar la sesión');}})();return()=>{cancelled=true;};
 },[user?.id,user?.role,load,refresh,sessionRetry]);
 useEffect(()=>{if(user?.role==='owner'&&confirmedId===user.id)void prepareAgents();},[user?.id,user?.role,confirmedId,prepareAgents]);
 if(user?.role!=='owner')return <main className="p-8"><h1>Configuración inicial reservada al propietario</h1><Link to="/chat">Abrir Micelclaw</Link></main>;
 if(confirmedId!==user.id)return <main className="p-8"><h1>Confirmando sesión del propietario…</h1>{sessionError&&<p role="alert">{sessionError}<Button onClick={()=>setSessionRetry(n=>n+1)}>Reintentar</Button><Link to="/login">Iniciar sesión</Link></p>}</main>;
 const index=steps.indexOf(progress.step);const pending=connectors?.filter(c=>c.collection_selection_pending===true)??[],confirmed=connectors?.filter(c=>c.collection_selection_pending!==true)??[];
 const go=(step:SetupStep)=>{setEditing(null);save({step,paused:false});void refresh();};
 const next=(skip=false)=>{if(index<steps.length-1){save({skipped:skip?[...new Set([...progress.skipped,progress.step])]:progress.skipped.filter(s=>s!==progress.step)});go(steps[index+1]!);}};
 async function finish(){if(finishing)return;setFinishing(true);const gen=useAuthStore.getState().sessionGeneration;try{const r=await api.post<{data:{note_id:string;available:boolean}}>('/initial-setup/welcome',{});if(useAuthStore.getState().user?.id!==confirmedId||useAuthStore.getState().sessionGeneration!==gen)return;save({paused:true,welcome_note_id:r.data.note_id});await useInitialSetupStore.getState().retryProgress();if(useInitialSetupStore.getState().storageError)throw new Error('La bienvenida está guardada; falta confirmar el progreso. Reintenta sin crear otra nota.');if(useAuthStore.getState().user?.id===confirmedId&&useAuthStore.getState().sessionGeneration===gen)navigate(r.data.available?`/notes?id=${r.data.note_id}`:'/notes');}catch(e){setErrors([e instanceof Error?e.message:'No se pudo finalizar']);}finally{setFinishing(false);}}
 const agentState=agents==='prepared'?'ok':agents==='error'?'error':'pending';
 const agentDescription=agents==='prepared'?'Agentes creados con sus archivos de inicio.':agents==='preparing'?'Preparando los agentes de este perfil…':agents==='error'?'No se ha completado la preparación de agentes.':'Preparación pendiente.';
 const agentBlock=<div className="space-y-2"><p role="status">{agentDescription}</p><p>No se asigna un modelo durante esta guía. Podrás configurar la IA más adelante en Gateway → Models; no se ha probado una respuesta de IA.</p>{agentsError&&<details><summary>Ver causa de la preparación pendiente</summary><p role="alert" className="break-words">{agentsError}</p></details>}{agents!=='prepared'&&<Button variant="outline" disabled={agents==='preparing'} onClick={()=>void prepareAgents()}>Reintentar preparación de agentes</Button>}</div>;
 return <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 sm:p-8"><div className="max-w-5xl mx-auto space-y-5">
 <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">Configuración inicial</h1><p>Propietario: {user.display_name} · <a href={window.location.origin} target="_blank" rel="noopener noreferrer" className="underline">{window.location.origin}</a></p></div><div className="flex gap-2"><Button variant="outline" disabled={integrationsBusy} onClick={()=>{save({paused:true});navigate('/chat');}}>Salir y retomar</Button><Button variant="ghost" disabled={signingOut} onClick={()=>void signOut()}>{signingOut?'Revocando sesión…':'Cerrar sesión'}</Button></div></header>{signOutError&&<p role="alert">{signOutError}</p>}
 <nav aria-label="Pasos de configuración" className="flex flex-wrap gap-2">{steps.map((step,i)=><Button key={step} disabled={integrationsBusy} variant={progress.step===step?'default':'outline'} onClick={()=>go(step)} aria-current={progress.step===step?'step':undefined}>{i+1}. {labels[step]}{progress.skipped.includes(step)?' · omitido':''}</Button>)}</nav>
 {progressConflict&&<p role="alert">Core tiene otro avance confirmado. Conserva explícitamente tu avance local o usa el confirmado. <Button onClick={()=>void useInitialSetupStore.getState().resolveProgressConflict('local')}>Conservar este avance</Button> <Button onClick={()=>void useInitialSetupStore.getState().resolveProgressConflict('server')}>Usar avance confirmado</Button></p>}
 {storageError&&!progressConflict&&<p role="alert">Falta confirmar la persistencia del progreso. Tus ajustes guardados permanecen. <Button onClick={()=>void useInitialSetupStore.getState().retryProgress()}>Reintentar persistencia</Button></p>}
 <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"><h2 className="text-lg font-semibold">{labels[progress.step]}</h2>
 {progress.step==='domain'&&<LocalDomainStep refreshVersion={domainRefreshVersion}/>}
 {progress.step==='preferences'&&(settingsError?<p role="alert">No se han leído los ajustes. <Button onClick={()=>void useSettingsStore.getState().fetchSettings()}>Reintentar</Button></p>:settings?<GeneralSection initialSetup/>:<p>Cargando preferencias…</p>)}
 {progress.step==='users'&&<><p>Tu cuenta conserva el rol de propietario. Grupos: {groupStatus??'comprobando…'}. Las cuentas nuevas son usuarios normales por defecto.</p>{groupError&&<p role="alert">{groupError}</p>}<DemoAccount/><UsersAndGroupsSection/><Card title="Agentes de tu perfil" state={agentState}>{agentBlock}</Card></>}
 {progress.step==='integrations'&&<><p>Autoriza una vez cada cuenta y elige qué sincronizar. Cada conexión aparece abajo al terminar su selección. Configurada no significa que sus datos ya se hayan importado.</p><GroupedIntegrations pending={pending} onBusy={setIntegrationsBusy} onRefresh={()=>void refresh()}/>{connectors===null?<p>No se pudieron verificar las conexiones.</p>:<ConnectedList connectors={confirmed} onRefresh={()=>void refresh()} onConfigure={setEditing}/>} {editing&&<div><Button variant="ghost" onClick={()=>setEditing(null)}>Cerrar colecciones</Button><CollectionsEditor key={editing} connectorId={editing}/></div>}</>}
 {progress.step==='applications'&&<ApplicationsStep/>}
 {progress.step==='summary'&&<><p className="text-[var(--text-dim)]">Este es el estado observado de tu instalación. Puedes retomar cualquier paso más adelante.</p><div className="grid gap-4 sm:grid-cols-2">
 <Card title="Acceso" state="ok"><p>Sesión del propietario confirmada.</p><a href={window.location.origin} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1 break-all">{window.location.origin}<ExternalLink size={13}/></a>{domain?.operational&&domain.url&&domain.url!==window.location.origin&&<p><a href={domain.url} target="_blank" rel="noopener noreferrer" className="underline">Dominio local HTTPS disponible</a></p>}</Card>
 <Card title="Preferencias" state={savedSettings&&!settingsError?'ok':'pending'}>{savedSettings&&!settingsError?<><p>Idioma: {savedSettings.general.language}</p><p>Zona horaria: {savedSettings.general.timezone}</p></>:<p>Lectura pendiente</p>}</Card>
 <Card title="Usuarios" state={usersCount===null||groupError?'pending':'ok'}><p>{usersCount===null?'Lectura pendiente':`${usersCount} cuentas observadas`}</p><p>Propietario · {groupStatus??'pertenencia a grupos pendiente'}</p><p>Paco Trueno mantiene su perfil independiente.</p>{groupError&&<p role="alert">{groupError}</p>}</Card>
 <Card title="Agentes e IA" state={agentState}>{agentBlock}</Card>
 <Card title="Integraciones" state={connectors===null||pending.length?'pending':confirmed.some(c=>c.status==='error')?'error':'ok'}>{connectors===null?<p>Lectura pendiente</p>:confirmed.length===0?<p>Ninguna integración terminada.</p>:<ul className="space-y-3">{confirmed.map(c=><li key={c.id} className="border-b border-[var(--border)] pb-2"><p className="font-medium">{c.display_name??c.name}</p><p>{c.status==='connected'?'Configurada':c.status==='paused'?'En pausa':c.status==='error'?'Con errores':c.status}</p><p className="text-xs text-[var(--text-dim)]">{c.last_sync_at?`Última sincronización observada: ${new Date(c.last_sync_at).toLocaleString()}`:'Aún sin sincronización observada'}</p></li>)}</ul>}{pending.length>0&&<p>{pending.length} selecciones pendientes; sus conexiones siguen pausadas.</p>}</Card>
 <Card title="Aplicaciones y requisitos pendientes" state="pending"><p>Companion y la extensión son opcionales. Preparar sus archivos no confirma el emparejamiento o la activación.</p><p>Docker y contenedores siguen pendientes. Esta instalación es parcial.</p><Button variant="outline" onClick={()=>go('applications')}>Ver aplicaciones</Button></Card>
 </div><p>Pasos omitidos: {progress.skipped.map(s=>labels[s]).join(', ')||'ninguno'}. Puedes retomarlos desde los botones de arriba.</p><Button disabled={busy||finishing} onClick={()=>void finish()}>{finishing?'Guardando bienvenida…':'Finalizar y abrir la bienvenida'}</Button></>}
 {errors.map(e=><p role="alert" key={e}>{e}</p>)}<Button variant="outline" disabled={busy||finishing||integrationsBusy} onClick={()=>{setDomainRefreshVersion(n=>n+1);void refresh();}}>Actualizar estados observados</Button></section>
 <footer className="flex flex-wrap gap-3"><Button variant="outline" disabled={index===0||integrationsBusy} onClick={()=>go(steps[index-1]!)}>Atrás</Button>{index<steps.length-1&&<><Button variant="ghost" disabled={integrationsBusy} onClick={()=>next(true)}>Omitir paso</Button><Button disabled={integrationsBusy} onClick={()=>next()}>Continuar</Button></>}</footer></div></main>;
}

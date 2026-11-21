import { useEffect,useState,useCallback } from 'react';
import { Link } from 'react-router';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { useInitialSetupStore } from '@/stores/initial-setup.store';
interface LocalState {instance_id:string|null;automatic_sync?:boolean;windows_available?:boolean;https_port:number;url:string|null;operational:boolean;domain:{domain:string;status:string;error_message?:string}|null;original_url:string;public_settings:string}
export function LocalDomainStep({refreshVersion=0}:{refreshVersion?:number}){
 const [name,setName]=useState('mi-micelclaw');const [state,setState]=useState<LocalState|null>(null);
 const [status,setStatus]=useState('pendiente');const [error,setError]=useState('');const [request,setRequest]=useState<string|null>(null);const [url,setUrl]=useState<string|null>(null);
 const storageError=useInitialSetupStore(s=>s.storageError);const savingProgress=useInitialSetupStore(s=>s.savingProgress);
 const refreshState=useCallback(async()=>{
  const result=await api.get<{data:LocalState}>('/initial-setup/local-access');
  setState(result.data);if(result.data.domain)setName(result.data.domain.domain.replace(/\.claw$/,''));
  setStatus(result.data.operational?'operativo':result.data.domain?.status==='error'?'error':request?'comprobando':'pendiente');
  setError(result.data.domain?.error_message??'');setUrl(result.data.url);return result.data;
 },[request]);
 useEffect(()=>{let done=false;void refreshState().catch(e=>{if(!done){setError(e.message);setStatus('error');}});return()=>{done=true;};},[refreshState,refreshVersion]);
 useEffect(()=>{if(!request)return;let done=false;let timer:ReturnType<typeof setTimeout>;const deadline=Date.now()+120000;
  const poll=async()=>{try{const r=await api.get<{data:{state:string;url:string;code?:string}}>(`/initial-setup/local-access/${request}`);if(done)return;
   if(r.data.state==='operational'){setStatus('operativo');setUrl(r.data.url);setError('');return;}
   if(r.data.state==='error'){setStatus('error');setError(r.data.code??'No se completó el acceso. La dirección original permanece disponible.');return;}
  }catch{if(done)return;}
  if(Date.now()<deadline)timer=setTimeout(poll,2000);else{setStatus('pendiente');setError('No se ha confirmado el acceso. Puedes reintentar; se conserva la dirección original.');}};void poll();return()=>{done=true;clearTimeout(timer);};},[request]);
 async function configure(){
  if(localStorage.getItem('claw_oauth_pending')){setError('Termina o cancela la autorización OAuth antes de cambiar de origen.');return;}
  setStatus('comprobando');setError('');
  try{
   const current=state??(await api.get<{data:LocalState}>('/initial-setup/local-access')).data;setState(current);
   if(!current.instance_id||current.windows_available===false)throw new Error('Configura el acceso desde el ajuste Dominios de esta plataforma.');
   if(current.automatic_sync!==true)throw new Error('Esta instalación necesita actualizar el acceso local desde el instalador del sistema. No se abrirá PowerShell ni se solicitarán permisos desde aquí.');
   const r=await api.post<{data:{request_id:string;automatic:boolean;url:string}}>('/initial-setup/local-access',{name});
   if(r.data.automatic!==true)throw new Error('No se confirmó la sincronización automática. Conserva la dirección original y reanuda la actualización del sistema.');
   setRequest(r.data.request_id);setUrl(r.data.url);
  }
  catch(e){setStatus('error');setError(e instanceof Error?e.message:'No se pudo preparar el acceso');}
 }
 return <div className="space-y-4"><label>Nombre: <input value={name} onChange={e=>setName(e.target.value.toLowerCase())} disabled={status==='comprobando'||!!state?.domain} className="border rounded bg-[var(--bg)] p-2"/>.claw</label>
 <p>Dirección resultante: {url??`https://${name}.claw:${state?.https_port??'puerto pendiente'}`}</p>
 <Button onClick={()=>void configure()} disabled={!state?.instance_id || state?.windows_available===false || status==='comprobando'}>Configurar acceso en este Windows</Button>
 <p role="status" className={status==='operativo'?'text-green-400':''}>Estado: {status==='operativo'?'✓ Dominio local disponible (HTTPS comprobado)':status}</p><Button variant="outline" onClick={()=>void refreshState().catch(e=>setError(e.message))}>Comprobar dominio ahora</Button>{state?.windows_available===false&&<p>Este paso automático corresponde a Windows. En Linux configura el acceso desde <Link to="/settings/domains">Dominios</Link> cuando DNS y proxy estén disponibles; puedes continuar con la dirección original.</p>}
 <p>Los permisos de Windows y la confianza del certificado se preparan durante la instalación del sistema. Este paso sincroniza el dominio automáticamente, sin abrir PowerShell ni pedir elevación. Solo configura este Windows; no publica Micelclaw en Internet ni activa PowerDNS. El acceso original permanece disponible.</p>
 {error&&<p role="alert">{error}</p>}{localStorage.getItem('claw_oauth_pending')&&<Button variant="outline" onClick={()=>{localStorage.removeItem('claw_oauth_pending');setError('Intento OAuth local descartado. Esto no revoca permisos externos; revisa las conexiones si habías autorizado.');}}>Descartar autorización pendiente</Button>}{status!=='comprobando'&&<Button variant="outline" onClick={()=>void configure()}>Reintentar</Button>}
 {status==='operativo'&&url&&<Button disabled={storageError||savingProgress} onClick={()=>{if(localStorage.getItem('claw_oauth_pending')){setError('OAuth sigue pendiente; no se cambiará el origen.');return;}window.location.assign(url+'/login');}}>Abrir dominio e iniciar sesión de nuevo</Button>}
 <p>Al cambiar de origen, inicia sesión normalmente. El progreso del propietario se recupera desde Core; no se transfieren credenciales en la dirección.</p>
 <p>Para configurar un dominio público necesitas DNS público y un certificado válido: <Link to="/settings/domains">abrir el ajuste Dominios</Link>.</p></div>;
}

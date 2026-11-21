import {useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router';
import {Button} from '@/components/ui/button';
import {api,ApiError} from '@/services/api';
import {useAuthStore} from '@/stores/auth.store';
import {toast} from 'sonner';
import type {OfficeSlot} from './office-providers.service';
import {useI18n} from '@/i18n';
interface Recovery {file_id:string;filename:string;provider:string;slot:OfficeSlot;epoch:string;revision:number;writable:boolean;expired:boolean;error:{message?:string}|null}
export function OfficeRecoveryPanel({slot,enabled}:{slot:OfficeSlot;enabled:boolean}){
 const {t}=useI18n();const tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);
 const [rows,setRows]=useState<Recovery[]>([]),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[refreshError,setRefreshError]=useState(''),[copy,setCopy]=useState<{id:string;reason:string}|null>(null),navigate=useNavigate();
 const refresh=useCallback(async()=>{if(!enabled){setRows([]);setRefreshError('');return;}try{setRows((await api.get<{data:Recovery[]}>('/office/recoveries')).data.filter(row=>row.slot===slot));setRefreshError('');}catch(error){if(error instanceof ApiError&&error.status===404){setRows([]);setRefreshError('');return;}setRefreshError(error instanceof Error?error.message:tRef.current('office.recovery.refreshError'));}},[slot,enabled]);
 useEffect(()=>{void refresh();},[refresh]);
 const action=async(row:Recovery,mode:'retry'|'download'|'copy')=>{
  setBusy(row.file_id);setError('');
  try{
   const base=`/office/providers/${encodeURIComponent(row.provider)}/rooms/${row.file_id}`;
   if(mode==='retry'){await api.post(base+(row.expired?'/recover':'/checkpoint'),{epoch:row.epoch});toast.success(t('office.recovery.saved'));}
   else if(mode==='download'){
    const generation=useAuthStore.getState().sessionGeneration;
    await api.post('/auth/session-cookie');
    const response=await fetch('/api/v1'+base+'/recovery/download?'+new URLSearchParams({epoch:row.epoch,revision:String(row.revision)}),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000)});
    if(!response.ok){const result=await response.json().catch(()=>null);throw Error(result?.error?.message||t('office.recovery.downloadError'));}
    const blob=await response.blob();if(useAuthStore.getState().sessionGeneration!==generation)throw Error(t('office.recovery.sessionChanged'));
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=row.filename.replace(/(\.[^.]+)$/,' (recuperado)$1');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }else{
    const body={epoch:row.epoch,revision:row.revision,mode:'copy'};
    let result:{data:{file_id:string;filename:string;resolved:boolean;reason?:string}};
    try{result=await api.post(base+'/recovery',body);}catch(error){
     if(!(error instanceof ApiError)||error.code!=='OFFICE_DESTINATION_REQUIRED'||!window.confirm(t('office.recovery.destination')))throw error;
     result=await api.post(base+'/recovery',{...body,destination:{parent_folder:'/drive/Documents/'}});
    }
    if(result.data.resolved){toast.success(t('office.recovery.copySaved'));navigate('/office/edit/'+result.data.file_id);}
    else setCopy({id:result.data.file_id,reason:result.data.reason||t('office.recovery.copyPending')});
   }
  }catch(error){setError(error instanceof Error?error.message:t('office.recovery.error'));}
  finally{setBusy(null);void refresh();}
 };
 if(!rows.length&&!error&&!refreshError&&!copy)return null;
 return <section aria-label={t('office.recovery.title')} className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
  <h3 className="mb-2 text-sm font-medium">{t('office.recovery.title')}</h3>
  {error&&<p role="alert" className="mb-2 text-sm text-[var(--text-dim)]">{error}</p>}
  {refreshError&&<p role="alert" className="mb-2 text-sm text-[var(--text-dim)]">{refreshError}</p>}
  {copy&&<p className="mb-2 text-sm">{copy.reason} <Button variant="outline" onClick={()=>navigate('/office/edit/'+copy.id)}>{t('office.recovery.openCopy')}</Button></p>}
  {rows.map(row=><div key={row.file_id} className="mb-3 flex flex-wrap items-center gap-2 text-sm">
   <strong className="mr-2">{row.filename}</strong><span className="text-[var(--text-dim)]">{row.error?.message||t('office.recovery.pending')}</span>
   <Button variant="outline" disabled={!!busy||!row.writable} onClick={()=>void action(row,'retry')}>{t('office.recovery.retry')}</Button>
   <Button variant="outline" disabled={!!busy||!row.writable} onClick={()=>void action(row,'download')}>{t('office.recovery.download')}</Button>
   <Button variant="outline" disabled={!!busy||!row.writable} onClick={()=>void action(row,'copy')}>{t('office.recovery.copy')}</Button>
   <Button variant="ghost" disabled={!!busy} onClick={()=>navigate('/office/edit/'+row.file_id)}>{t('office.recovery.reopen')}</Button>
   {!row.writable&&<span>{t('office.recovery.readOnly')}</span>}
  </div>)}
 </section>;
}

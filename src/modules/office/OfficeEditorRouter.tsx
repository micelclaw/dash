import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/services/api';
import { getOfficeProviders, officeFilenameSupported, openOfficeDocument } from './office-providers.service';
import {OfficeDestinationPicker} from './OfficeDestinationPicker';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/i18n';
import { OfficeErrorState } from './OfficeErrorState';
import { officeColor } from '@/config/office-colors';
// Legacy route wrappers may still pass this prop; retired editors are never selected.
export function OfficeEditorRouter(_props?: { legacy?: ComponentType }) {
  const {t}=useI18n(); const tRef=useRef(t); useEffect(()=>{tRef.current=t;},[t]);
  const { fileId } = useParams<{ fileId: string }>(); const navigate = useNavigate(); const [query] = useSearchParams();
  const [state, setState] = useState<{ fileId?: string; unavailable?:boolean; error?: string; destinationRequired?:boolean }>({});
  const [destination,setDestination]=useState<{fileId:string;parent_folder:string}|null>(null),[picking,setPicking]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    let alive = true;
    const controller=new AbortController();pending.current=controller;
    setState({ fileId });
    const open = async () => {
      const status = await getOfficeProviders();
      if (!alive) return;
      if (status.providers.length === 0) { setState({fileId,error:tRef.current('office.router.unavailable'),unavailable:true});return; }
      const {data:file}=await api.get<{data:{filename:string;is_directory:boolean}}>(`/files/${encodeURIComponent(fileId!)}`,undefined,{signal:controller.signal});
      if (!alive) return;
      if (file.is_directory || !status.providers.some(provider=>provider.preferred&&officeFilenameSupported(file.filename,provider.formats))) {
        setState({fileId,error:tRef.current('office.router.unsupported')});return;
      }
      try {
        const result = await openOfficeDocument(fileId!,undefined,{signal:controller.signal,destination:destination&&destination.fileId===fileId?{parent_folder:destination.parent_folder}:undefined});
        if (!alive) return;
        const target = new URL(result.editor_url, window.location.origin);
        if (query.get('fullscreen') === '1') target.searchParams.set('fullscreen', '1');
        navigate(target.pathname + target.search, { replace: true });
      } catch (error) {
        if (!alive) return;
        if(error instanceof ApiError&&error.code==='OFFICE_DESTINATION_REQUIRED')setState({fileId,error:error.message,destinationRequired:true});
        else if (error instanceof ApiError && error.code === 'OFFICE_PROVIDER_UNAVAILABLE') setState({fileId,error:tRef.current('office.router.unavailable'),unavailable:true});
        else throw error;
      }
    };
    void open().catch(error => { if (alive) setState({ fileId, error: error instanceof Error ? error.message : tRef.current('office.router.error') }); });
    return () => { alive = false;controller.abort();if(pending.current===controller)pending.current=null; };
  }, [fileId, navigate, query,destination,attempt]);
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-6" role={state.error?undefined:'status'}>
    {state.error ? <OfficeErrorState message={state.unavailable?t('office.router.unavailable'):state.error}
      color={officeColor(query.get('app')??undefined)}
      retryLabel={state.destinationRequired?t('office.router.choose'):undefined}
      onRetry={()=>{if(state.destinationRequired)setPicking(true);else setAttempt(n=>n+1);}} />
      : <><Loader2 className="animate-spin" size={28} /><p>{t('office.router.opening')}</p><Button variant="outline" onClick={()=>{pending.current?.abort();navigate('/office');}}>{t('office.router.cancel')}</Button></>}
    <OfficeDestinationPicker open={picking} onCancel={()=>setPicking(false)} onSelect={path=>{setPicking(false);setDestination({fileId:fileId!,parent_folder:path});}} />
  </div>;
}

import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {api} from '@/services/api';
import {useI18n} from '@/i18n';
interface Folder {id:string;filename:string;filepath:string}
/** Selects the location for a new copy. Core checks creation rights separately. */
export function OfficeDestinationPicker({open,onSelect,onCancel}:{open:boolean;onSelect:(path:string)=>void;onCancel:()=>void}){
 const {t}=useI18n(); const tRef=useRef(t); useEffect(()=>{tRef.current=t;},[t]);
 const [path,setPath]=useState('/drive/'),[folders,setFolders]=useState<Folder[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(open)setPath('/drive/');},[open]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();let alive=true;
  setLoading(true);setError('');setFolders([]);
  void api.get<{data:Folder[]}>('/files',{parent_folder:path,is_directory:true},{signal:controller.signal}).then(result=>{if(alive)setFolders(result.data);}).catch(error=>{if(alive)setError(error instanceof Error?error.message:tRef.current('office.destination.error'));}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;controller.abort();};
 },[open,path,retry]);
 const parent=path==='/drive/'?null:path.replace(/\/$/,'').split('/').slice(0,-1).join('/')+'/';
 return <Dialog open={open} onOpenChange={value=>{if(!value)onCancel();}}><DialogContent>
  <DialogHeader><DialogTitle>{t('office.destination.title')}</DialogTitle><DialogDescription>{t('office.destination.description')}</DialogDescription></DialogHeader>
  <p className="break-all text-sm">{path.replace(/^\/drive\/?/,'Drive / ')}</p>
  {parent&&<Button variant="ghost" onClick={()=>setPath(parent)}>{t('office.destination.parent')}</Button>}
  {loading?<p role="status">{t('office.destination.loading')}</p>:error?<p role="alert">{error} <Button variant="outline" onClick={()=>setRetry(value=>value+1)}>{t('office.destination.retry')}</Button></p>:<div className="max-h-64 overflow-auto">{folders.map(folder=><Button key={folder.id} className="mb-1 w-full justify-start" variant="ghost" onClick={()=>setPath(folder.filepath.replace(/\/?$/,'/'))}>{folder.filename}</Button>)}{!folders.length&&<p className="text-sm">{t('office.destination.empty')}</p>}</div>}
  <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onCancel}>{t('office.destination.cancel')}</Button><Button disabled={loading||!!error} onClick={()=>onSelect(path)}>{t('office.destination.save')}</Button></div>
 </DialogContent></Dialog>;
}

import {useState} from 'react';
import {X,Send,Square} from 'lucide-react';
import {toast} from 'sonner';
import {ChatPanel} from '@/components/shell/ChatPanel';
import {AgentSelector} from '@/components/shell/AgentSelector';
import {useChatStore} from '@/stores/chat.store';
import type {OfficeSlot} from './office-providers.service';
import {useI18n} from '@/i18n';
export interface OfficeAgentFile {id:string;filename:string;provider:string;slot:OfficeSlot}
/** Uses the existing Micelclaw identity, selected agent, conversation and approvals. */
export default function OfficeAgentPanel({file,dirty,readOnly,onClose}:{file:OfficeAgentFile;dirty:boolean;readOnly:boolean;onClose:()=>void}){
 const {t}=useI18n();
 const [text,setText]=useState(''),sending=useChatStore(state=>!!state.streamingMessage);
 const send=()=>{
  if(!text.trim()||sending)return;
  const result=useChatStore.getState().sendMessage(text.trim(),{
   module:'office',active_item:{id:file.id,type:'office-document',title:file.filename},
   editor_context:{service:'office',fileId:file.id,provider:file.provider,documentType:file.slot,protocol_version:1,isEditing:true,changes_pending:dirty,read_only:readOnly,note:'Usa office_execute con fileId y operaciones estructuradas. El archivo pertenece a Drive. Los cambios pendientes del editor deben confirmarse antes de basarse en la versión guardada.'},
  });
  if(result.accepted)setText('');else toast.error(t(result.reason==='read_only'?'office.agent.readOnlyError':'office.agent.sendError'));
 };
 return <aside aria-label={t('office.agent.title')} style={{position:'absolute',right:0,top:48,bottom:0,width:'min(440px,100%)',zIndex:20,display:'flex',flexDirection:'column',background:'var(--bg)',borderLeft:'1px solid var(--border)',boxShadow:'-4px 0 16px #0003'}}>
  <div className="flex items-center gap-2 border-b border-[var(--border)] p-3"><strong className="flex-1">{t('office.agent.title')}</strong><button aria-label={t('office.agent.close')} onClick={onClose}><X size={18}/></button></div>
  <p className="m-3 text-sm text-[var(--text-dim)]">{file.filename}{readOnly?` · ${t('office.agent.readOnly')}`:''}{dirty?` · ${t('office.agent.pending')}`:''}</p>
  <div className="min-h-0 flex-1 overflow-auto"><ChatPanel/></div>
  <form className="flex flex-col gap-2 border-t border-[var(--border)] p-3" onSubmit={event=>{event.preventDefault();send();}}>
   <AgentSelector/>
   <textarea aria-label={t('office.agent.message')} placeholder={t('office.agent.placeholder')} value={text} onChange={event=>setText(event.target.value)} rows={3} className="resize-y rounded border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--text)]"/>
   {sending?<button type="button" className="flex items-center justify-center gap-2" onClick={()=>useChatStore.getState().cancelStream()}><Square size={14}/>{t('office.agent.stop')}</button>:<button type="submit" disabled={!text.trim()} className="flex items-center justify-center gap-2 disabled:opacity-40"><Send size={16}/>{t('office.agent.send')}</button>}
  </form>
 </aside>;
}

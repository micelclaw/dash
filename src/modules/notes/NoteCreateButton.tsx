/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { Plus,ChevronDown } from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/services/api';
import {useAuthStore} from '@/stores/auth.store';
import type {ApiResponse} from '@/types/api';
import type {Note} from '@/types/notes';
import {toast} from 'sonner';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
interface Target{connector_id:string;label:string;provider?:'notion-notes'|'nextcloud-notes';create_certified:boolean;collections:Array<{id:string;label:string}>;}
interface Intent{connector_id:string;parent_id:string;title:string;idempotency_key:string;}

interface NoteCreateButtonProps {
  onClick: () => void;
  onCreated?:(note:Note)=>void;
}

export function NoteCreateButton({ onClick,onCreated }: NoteCreateButtonProps) {
  const owner=useAuthStore(state=>state.user?.id);
  return <NoteCreateActions key={owner??'anonymous'} owner={owner} onClick={onClick} onCreated={onCreated}/>;
}
function NoteCreateActions({onClick,onCreated,owner}:NoteCreateButtonProps&{owner?:string}){
  const { t } = useI18n();
  const storageKey=`notes-create-intent:${owner??'anonymous'}`;
  const[open,setOpen]=useState(false),[targets,setTargets]=useState<Target[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const[draft,setDraft]=useState<Intent>({connector_id:'',parent_id:'',title:'',idempotency_key:crypto.randomUUID()});
  const[attempted,setAttempted]=useState(false),sending=useRef(false);
  const[provider,setProvider]=useState<'notion-notes'|'nextcloud-notes'>('notion-notes');
  const identity=useRef<string|undefined>(owner);
  useEffect(()=>{identity.current=owner;return()=>{identity.current=undefined;};},[owner]);
  const chosen=targets.find(target=>target.connector_id===draft.connector_id);
  const available=Boolean(chosen?.create_certified&&chosen.collections.some(collection=>collection.id===draft.parent_id));
  async function show(nextProvider:'notion-notes'|'nextcloud-notes'){
    const openedBy=owner;
    setProvider(nextProvider);
    setOpen(true);setLoading(true);setError('');
    try{
      const response=await api.get<ApiResponse<Target[]>>('/notes/create-targets');if(identity.current!==openedBy)return;
      const scoped=response.data.filter(target=>(target.provider??'notion-notes')===nextProvider);setTargets(scoped);
      const saved=sessionStorage.getItem(nextProvider==='notion-notes'?storageKey:`${storageKey}:nextcloud`);let previous:Intent|undefined;
      if(saved){try{const value=JSON.parse(saved),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
        if(typeof value.title==='string'&&value.title.length<=2000&&uuid.test(value.connector_id)&&uuid.test(value.idempotency_key)
          &&scoped.some(target=>target.connector_id===value.connector_id&&target.create_certified&&target.collections.some(collection=>collection.id===value.parent_id)))previous=value;
      }catch{/* Ignore malformed browser metadata; invalid requests cannot reach the queue. */}}
      setAttempted(Boolean(previous));
      if(previous)setDraft(previous);
      else{const first=scoped.find(target=>target.create_certified&&target.collections.length);setDraft({connector_id:first?.connector_id??'',parent_id:first?.collections[0]?.id??'',title:'',idempotency_key:crypto.randomUUID()});}
    }catch(reason){setError(reason instanceof Error?reason.message:t('notes.targetsFailed'));}
    finally{setLoading(false);}
  }
  async function submit(){
    if(sending.current||!available)return;
    if(draft.title.length>2000){setError(t('notes.titleLimit'));return;}
    sending.current=true;setBusy(true);setError('');
    const submittedBy=owner;
    const input={...draft,title:draft.title||'Sin título'};setDraft(input);setAttempted(true);
    try{
      // Persist before sending: if browser storage fails, do not send an unrepeatable request.
      const intentKey=provider==='notion-notes'?storageKey:`${storageKey}:nextcloud`;
      sessionStorage.setItem(intentKey,JSON.stringify(input));
      const response=await api.post<ApiResponse<Note>>('/notes/connected',input,{timeout:150000});
      sessionStorage.removeItem(intentKey);if(identity.current!==submittedBy)return;setAttempted(false);setOpen(false);onCreated?.(response.data);
      if(response.data.sync?.state==='synced')toast.success(t(provider==='notion-notes'?'notes.createdNotion':'notes.createdNextcloud'));
      else toast.info(t(provider==='notion-notes'?'notes.pendingNotion':'notes.pendingNextcloud'));
    }catch(reason){if(identity.current===submittedBy)setError(reason instanceof Error?reason.message:t('notes.createUnconfirmed'));}
    finally{sending.current=false;setBusy(false);}
  }
  return (
    <>
    <div style={{display:'flex',gap:4,margin:'8px 12px'}}>
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex:1,
        padding: '8px 12px',
        background: 'var(--amber)',
        color: '#06060a',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--amber-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--amber)')}
    >
      <Plus size={16} />
      {t('notes.new')}
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button aria-label={t('notes.create.destination')} className="rounded px-2" style={{background:'var(--amber)',color:'#06060a'}}><ChevronDown size={16}/></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onClick}>{t('notes.newLocal')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={()=>void show('notion-notes')}>{t('notes.createNotion')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={()=>void show('nextcloud-notes')}>{t('notes.createNextcloud')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
    <Dialog open={open} onOpenChange={value=>{if(!sending.current)setOpen(value);}}>
      <DialogContent className="space-y-4">
        <DialogTitle>{t(provider==='notion-notes'?'notes.createNotion':'notes.createNextcloud')}</DialogTitle>
        <DialogDescription>{t(provider==='notion-notes'?'notes.createNotionDescription':'notes.createNextcloudDescription')}</DialogDescription>
        {loading?<p role="status">{t('notes.loadingDestinations')}</p>:<>
          {!targets.some(target=>target.create_certified&&target.collections.length)&&<p>{t(provider==='notion-notes'?'notes.notVerifiedNotion':'notes.notVerifiedNextcloud')}</p>}
          <label className="block">{t('notes.connection')}<select aria-label={t(provider==='notion-notes'?'notes.connectionNotion':'notes.connectionNextcloud')} className="block w-full rounded border p-2 bg-[var(--bg-secondary)] text-[var(--text-primary)]" value={draft.connector_id} disabled={busy||attempted} onChange={event=>{const next=targets.find(target=>target.connector_id===event.target.value);setDraft({...draft,connector_id:event.target.value,parent_id:next?.collections[0]?.id??''});}}>
            <option value="">{t('notes.selectConnection')}</option>{targets.map(target=><option key={target.connector_id} value={target.connector_id} disabled={!target.create_certified}>{target.label}</option>)}
          </select></label>
          <label className="block">{t(provider==='notion-notes'?'notes.destinationPage':'notes.destinationCategory')}<select aria-label={t(provider==='notion-notes'?'notes.destinationPage':'notes.destinationCategory')} className="block w-full rounded border p-2 bg-[var(--bg-secondary)] text-[var(--text-primary)]" value={draft.parent_id} disabled={busy||attempted} onChange={event=>setDraft({...draft,parent_id:event.target.value})}>
            <option value="">{t(provider==='notion-notes'?'notes.selectPage':'notes.selectCategory')}</option>{chosen?.collections.map(collection=><option key={collection.id} value={collection.id}>{collection.label}</option>)}
          </select></label>
          <label className="block">{t('notes.title')}<input aria-label={t('notes.newTitle')} placeholder={t('notes.untitledPlaceholder')} maxLength={2000} className="block w-full rounded border p-2 bg-[var(--bg-secondary)] text-[var(--text-primary)]" value={draft.title} disabled={busy||attempted} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
        </>}
        {error&&<p role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button disabled={busy} onClick={()=>setOpen(false)}>{t('notes.close')}</button>
          <button disabled={busy||loading||!available} className="rounded px-3 py-2 disabled:opacity-50" style={{background:'var(--amber)',color:'#06060a'}} onClick={()=>void submit()}>{busy?t('notes.creating'):attempted?t('notes.checkSameRequest'):t('notes.create')}</button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

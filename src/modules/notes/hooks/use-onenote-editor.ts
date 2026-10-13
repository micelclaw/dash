import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { Note, NoteAttachment } from '@/types/notes';
import { oneNoteEditorChanges, oneNoteEditorHtml, oneNoteEditorIdentityMap, rebaseOneNoteEditorHtml, type OneNoteEditorAuthority } from '../onenote-editor-bridge';
import {notionEditorChanges, notionEditorHtml, notionEditorIdentityMap, type NotionEditorAuthority} from '../notion-editor-bridge';
type Authority = OneNoteEditorAuthority | NotionEditorAuthority;

/** Provider adapter for NoteEditor. No new editor, native viewer or whole-body save. */
export function useOneNoteEditor(note: Note | null, editor: Editor | null, onConfirmed: (note: Note) => void, blocked?:RefObject<boolean>) {
  const notion = note?.sync?.provider === 'notion-notes';
  const providerLabel = notion ? 'Notion' : 'OneNote';
  const active = ['onenote-notes','notion-notes'].includes(note?.sync?.provider || '') && note?.sync?.owner && note.sync.write_certified;
  const eligible = active && note.sync?.owner && note.sync.write_certified && note.sync.state === 'synced' && note._shared_permission !== 'read';
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = useRef<{ id: string; authority: Authority; baseline: string; draft: string; images:Record<string,string> } | null>(null);
  const imageUrls = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const confirm = useRef(onConfirmed); confirm.current = onConfirmed;
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); for(const url of imageUrls.current)URL.revokeObjectURL(url);imageUrls.current=[]; };
  }, []);
  useEffect(() => {
    if (!editor || !active) return;
    const warn = () => setError('Las imágenes y los dibujos del lienzo están protegidos. Se han conservado sin cambios.');
    editor.view.dom.addEventListener('note-native-protected', warn);
    return () => editor.view.dom.removeEventListener('note-native-protected', warn);
  }, [editor, active]);

  useEffect(() => {
    if (!active || !note || !editor) { session.current = null; setReady(false); setAuthorized(false); setDirty(false);for(const url of imageUrls.current)URL.revokeObjectURL(url);imageUrls.current=[]; return; }
    if (session.current?.id === note.id && (session.current.draft !== session.current.baseline || busy.current ||
      !note.sync?.local_revision || session.current.authority.local_revision === note.sync.local_revision)) return;
    let current = true; const urls: string[] = [];
    setReady(false); setAuthorized(false); setDirty(false); setError('');
    void (async () => {
      try {
        const [authorityResponse, filesResponse] = await Promise.all([
          api.get<ApiResponse<Authority>>(`/notes/${note.id}/editable-units`),
          api.get<ApiResponse<NoteAttachment[]>>(`/notes/${note.id}/attachments`),
        ]);
        const images: Record<string, string> = {};
        await Promise.all(filesResponse.data.filter(file => file.kind === 'copied' && file.resource_ref &&
          ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mime_type || '')).map(async file => {
          try {
            const response = await api.getBlob(`/notes/${note.id}/attachments/${file.id}/download`);
            if (!current) return;
            const url = URL.createObjectURL(new Blob([response.blob], { type: file.mime_type! }));
            urls.push(url); images[file.resource_ref!] = url;
          } catch { /* attachment remains available separately */ }
        }));
        if (!current) return;
        editor.commands.setContent(notion ? notionEditorHtml(note.content, authorityResponse.data as NotionEditorAuthority, images)
          : oneNoteEditorHtml(note.content, (authorityResponse.data as OneNoteEditorAuthority).units, images), { emitUpdate: false });
        for(const url of imageUrls.current)URL.revokeObjectURL(url);imageUrls.current=urls;
        const baseline = editor.getHTML();
        session.current = { id: note.id, authority: authorityResponse.data, baseline, draft: baseline,images };
        setAuthorized(authorityResponse.data.enabled);
        setReady(true);
      } catch { if (current) setError(`No se pudo preparar la edición de ${providerLabel}.`); }
    })();
    return () => { current = false; if(imageUrls.current!==urls)for (const url of urls) URL.revokeObjectURL(url); };
    // Incoming content/status must not reset the document while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, note?.sync?.local_revision, active, editor]);

  const flush = useCallback(async () => {
    const state = session.current;
    if (!state || !editor || busy.current || blocked?.current || state.draft === state.baseline || !state.authority.enabled) return;
    const submitted = state.draft;
    try {
      const operations = notion ? notionEditorChanges(state.baseline, submitted, state.authority as NotionEditorAuthority)
        : oneNoteEditorChanges(state.baseline, submitted, state.authority as OneNoteEditorAuthority);
      if (!operations.length) { state.baseline = submitted; setDirty(state.draft !== submitted); return; }
      busy.current = true; setSaving(true); setError('');
      await api.post(`/notes/${state.id}/sync-edit`, { expected_local_revision: state.authority.local_revision, operations }, { timeout: 150_000 });
      const status = await api.get<ApiResponse<{ state: string }>>(`/notes/${state.id}/sync-state`);
      if (status.data.state !== 'synced') throw new Error(`Guardado pendiente o conflicto en ${providerLabel}. Tu borrador se conserva.`);
      const [authority, fresh] = await Promise.all([
        api.get<ApiResponse<Authority>>(`/notes/${state.id}/editable-units`),
        api.get<ApiResponse<Note>>(`/notes/${state.id}`),
      ]);
      if (session.current !== state || !mounted.current) return;
      const structural=operations.some(operation=>operation.op==='insert_unit'||operation.op==='delete_unit');
      if(notion&&state.draft===submitted){
        const identities=notionEditorIdentityMap(submitted,state.authority as NotionEditorAuthority,authority.data as NotionEditorAuthority,structural);
        const selection=editor.state.selection;
        const anchor=(position:number)=>{const resolved=editor.state.doc.resolve(position);
          for(let depth=resolved.depth;depth>0;depth--){const attrs=resolved.node(depth).attrs;
            const key=attrs.nativeIndex!==null&&attrs.nativeIndex!==undefined?`unit:${attrs.nativeIndex}`:attrs.nativeDraftId?`draft:${attrs.nativeDraftId}`:null;
            if(key&&identities.has(key))return {index:identities.get(key)!,offset:position-resolved.start(depth)};
          }return null;};
        const from=anchor(selection.from),to=anchor(selection.to);
        editor.commands.setContent(notionEditorHtml(fresh.data.content,authority.data as NotionEditorAuthority,state.images),{emitUpdate:false});
        const resolve=(point:ReturnType<typeof anchor>,fallback:number)=>{let result=Math.min(fallback,editor.state.doc.content.size);
          if(point)editor.state.doc.descendants((node,position)=>{if(String(node.attrs.nativeIndex)===point.index){result=Math.min(position+node.nodeSize-1,position+1+point.offset);return false;}});
          return result;};
        editor.commands.setTextSelection({from:resolve(from,selection.from),to:resolve(to,selection.to)});
        state.baseline=editor.getHTML();state.draft=state.baseline;
      }else if (notion || structural) {
        const identities = notion ? notionEditorIdentityMap(submitted,state.authority as NotionEditorAuthority,authority.data as NotionEditorAuthority,structural)
          : oneNoteEditorIdentityMap(submitted, fresh.data.content);
        const transaction = editor.state.tr;
        editor.state.doc.descendants((node, position) => {
          const key = node.attrs.nativeIndex !== null && node.attrs.nativeIndex !== undefined ? `unit:${node.attrs.nativeIndex}`
            : `draft:${node.attrs.nativeDraftId}`;
          const index = identities.get(key); if (index === undefined) return;
          transaction.setNodeMarkup(position, undefined, { ...node.attrs, nativeIndex: index, nativeDraftId: null });
        });
        editor.view.dispatch(transaction.setMeta('preventUpdate', true).setMeta('addToHistory', false));
        state.baseline = rebaseOneNoteEditorHtml(submitted, identities); state.draft = editor.getHTML();
      } else state.baseline = submitted;
      state.authority = authority.data;
      setAuthorized(authority.data.enabled); setDirty(state.draft !== state.baseline);
      confirm.current(fresh.data); setStatus(`Guardado en ${providerLabel}.`);
    } catch (reason) {
      if (mounted.current && session.current === state) setError(reason instanceof Error ? reason.message : 'No se pudo confirmar el guardado. Tu borrador se conserva.');
      // No automatic retry of an ambiguous remote mutation. Keep the exact draft.
      return;
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
    if (state.draft !== state.baseline && session.current === state) timer.current = setTimeout(() => void flushRef.current(), 1200);
  }, [editor, notion, providerLabel,blocked]);
  flushRef.current = flush;

  const onChange = useCallback((html: string) => {
    const state = session.current;
    if (!state || !eligible || !ready || blocked?.current || !state.authority.enabled) return;
    state.draft = html;
    setDirty(html !== state.baseline);
    setStatus('');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 1200);
  }, [eligible, ready,blocked]);
  const hasPending=()=>busy.current||Boolean(session.current&&session.current.draft!==session.current.baseline);
  return { active, enabled: Boolean(eligible && ready && authorized&&!blocked?.current), ready, dirty, saving, error, status, onChange,hasPending };
}

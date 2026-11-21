import { useRef, useState } from 'react';
import { NoteContent } from './NoteContent';
import { NativeNoteEdit, canEditNativeNote } from './NativeNoteEdit';
import type { Note } from '@/types/notes';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { More, Origin, QueryState, SaveForm, Search } from './shared';
import { pageOffset, pageSize } from './selection-adapters';
import { noteEditPolicy } from '@/modules/notes/note-edit-policy';
import { UnconfirmedWriteError } from './write-outcome';
import { RelatedNotes } from './RelatedNotes';

function NoteEdit({ note, transport, done, cancel }: { note: Note; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [title, setTitle] = useState(note.title || ''); const [content, setContent] = useState(note.content);
 const submitted = useRef<string | null>(null); const connected = note.sync?.provider === 'nextcloud-notes';
 async function verifyConnected() {
  const fresh = (await transport.call<Note>('notes', 'get', { id: note.id })).data;
  if (submitted.current === null || fresh.sync?.state !== 'synced' || !fresh.sync.local_revision || fresh.content_format !== 'markdown' || fresh.content !== submitted.current) throw new UnconfirmedWriteError('provider');
  done();
 }
 return <SaveForm onCancel={cancel} onVerify={connected ? verifyConnected : undefined} onSave={async () => {
  if (connected) {
   if (content === note.content) { done(); return; }
   submitted.current = content;
   await transport.call('notes', 'sync_edit', { id: note.id, expected_local_revision: note.sync!.local_revision, operations: [{ op: 'replace_body', content }] });
   try { await verifyConnected(); } catch { throw new UnconfirmedWriteError('provider'); }
   return;
  }
  await transport.call('notes', 'update', { id: note.id, title, content, content_format: note.content_format }); done();
 }}>{!connected && <label>Título<input value={title} onChange={event => setTitle(event.target.value)} /></label>}
  <label>Contenido<textarea rows={14} value={content} onChange={event => setContent(event.target.value)} /></label></SaveForm>;
}
function canEditConnected(note: Note) {
 return Boolean(note.sync?.provider === 'nextcloud-notes' && note.sync.owner && note.sync.write_certified && note.sync.remote_editable !== false && note.sync.state === 'synced' && note.sync.local_revision && note.content_format === 'markdown' && note._shared_permission !== 'read');
}
export default function NotesView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [offset, setOffset] = useState(() => pageOffset(context));
 const [selected, setSelected] = useState<string | null>(['get', 'editable_units', 'related'].includes(context.selection.action) ? String(context.selection.params.id) : null);
 const [editing, setEditing] = useState(false);
 const limit = pageSize(context); const filters = context.selection.action === 'list' ? context.selection.params : {};
 const list = useProductivityQuery(`notes:${search}:${offset}`, async signal => pageOf(await transport.call<Note[]>('notes', 'list', { ...filters, search, limit, offset }, signal), limit));
 const detail = useProductivityQuery(`note:${selected}`, async signal => selected ? (await transport.call<Note>('notes', 'get', { id: selected }, signal)).data : null);
 return <><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} />
  <div className="productivity-split"><section aria-label="Lista de notas"><QueryState {...list} empty={!list.data?.items.length} retry={list.refresh}>
   {list.data?.items.map(note => <button className="productivity-list-row" key={note.id} aria-pressed={selected === note.id} disabled={editing} onClick={() => setSelected(note.id)}><strong>{note.title || 'Sin título'}</strong><Origin entity={note} /></button>)}
   <More offset={offset} limit={limit} hasMore={list.data?.hasMore ?? false} onChange={setOffset} />
  </QueryState></section><article aria-label="Nota seleccionada"><QueryState {...detail} retry={detail.refresh}>
   {detail.data ? <><h2>{detail.data.title || 'Sin título'}</h2><Origin entity={detail.data} />
    {editing ? canEditNativeNote(detail.data) ? <NativeNoteEdit key={detail.data.id} note={detail.data} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); detail.refresh(); list.refresh(); }} /> : <NoteEdit key={detail.data.id} note={detail.data} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); detail.refresh(); list.refresh(); }} />
     : <><NoteContent note={detail.data} />{((detail.data.source === 'local' && !noteEditPolicy(detail.data).bodyReadOnly) || canEditConnected(detail.data) || canEditNativeNote(detail.data)) && <button onClick={() => setEditing(true)}>Editar nota</button>}
      {detail.data.sync && !canEditConnected(detail.data) && !canEditNativeNote(detail.data) && <p>Esta nota conserva el formato del proveedor. La edición requiere sus controles certificados.</p>}</>}
    {!editing && <RelatedNotes key={detail.data.id} id={detail.data.id} transport={transport} select={setSelected}
     limit={context.selection.action === 'related' ? Math.min(25, pageSize(context, 10)) : 10}
     initialOffset={context.selection.action === 'related' && context.selection.params.id === detail.data.id ? pageOffset(context) : 0} />}
   </> : <p>Selecciona una nota para leerla aquí.</p>}
  </QueryState></article></div></>;
}

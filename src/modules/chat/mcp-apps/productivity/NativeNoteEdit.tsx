import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, Italic, Underline, Strikethrough, Undo2, Redo2 } from 'lucide-react';
import type { Note } from '@/types/notes';
import { NativeNoteIdentity, NativeNoteProtected } from '@/modules/notes/extensions/native-note';
import { oneNoteEditorChanges, oneNoteEditorHtml, oneNoteEditorIdentityMap, rebaseOneNoteEditorHtml, type OneNoteEditorAuthority } from '@/modules/notes/onenote-editor-bridge';
import { notionEditorChanges, notionEditorHtml, notionEditorIdentityMap, type NotionEditorAuthority } from '@/modules/notes/notion-editor-bridge';
import type { ProductivityTransport } from './types';
import { QueryState, SaveForm } from './shared';
import { useProductivityQuery } from './use-productivity-query';
import { DraftsContext } from './drafts';
import { inertNoteHtml } from './NoteContent';
import { UnconfirmedWriteError } from './write-outcome';

type Authority = OneNoteEditorAuthority | NotionEditorAuthority;
export function canEditNativeNote(note: Note) {
 return Boolean(['notion-notes', 'onenote-notes'].includes(note.sync?.provider || '') && note.sync?.owner && note.sync.write_certified && note.sync.remote_editable !== false && note.sync.state === 'synced' && note.sync.local_revision && note._shared_permission !== 'read');
}
const extensions = (notion: boolean, editing: boolean) => [
 StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } } }),
 TaskList, TaskItem.configure({ nested: true }),
 NativeNoteIdentity.configure({ enabled: () => editing, unitBlocks: () => notion }), NativeNoteProtected,
];
const prepare = (note: Note, authority: Authority, notion: boolean) => notion
 ? notionEditorHtml(inertNoteHtml(note.content, true), authority as NotionEditorAuthority, {})
 : oneNoteEditorHtml(inertNoteHtml(note.content, true), (authority as OneNoteEditorAuthority).units, {});

/** The module's native adapters and protected nodes, with explicit submit and native MCP transport. */
export function NativeNoteEdit({ note, transport, done, cancel }: { note: Note; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const query = useProductivityQuery(`native-note-controls:${note.id}`, async signal => {
  const [fresh, controls] = await Promise.all([
   transport.call<Note>('notes', 'get', { id: note.id }, signal), transport.call<Authority>('notes', 'editable_units', { id: note.id }, signal),
  ]);
  if (!canEditNativeNote(fresh.data) || !controls.data.enabled) throw Error('Esta nota no permite editar con este acceso o certificación.');
  if (controls.data.local_revision !== fresh.data.sync?.local_revision) throw Error('La nota ha cambiado. Vuelve a consultar sus controles antes de editar.');
  return { note: fresh.data, authority: controls.data };
 });
 return <><QueryState {...query} retry={query.refresh}>{query.data && <NativeComposer {...query.data} transport={transport} done={done} cancel={cancel} />}</QueryState>{(query.loading || query.error) && <button type="button" onClick={cancel}>Volver a la nota</button>}</>;
}
function NativeComposer({ note, authority, transport, done, cancel }: { note: Note; authority: Authority; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const notion = note.sync?.provider === 'notion-notes';
 const html = useMemo(() => prepare(note, authority, notion), [note, authority, notion]);
 const baseline = useRef(''); const submitted = useRef<string | null>(null);
 const [locked, setLocked] = useState(false); const [notice, setNotice] = useState('');
 const drafts = useContext(DraftsContext); const draftId = useId();
 const editor = useEditor({ extensions: extensions(notion, true), content: html,
  onCreate: ({ editor }) => { if (!baseline.current) baseline.current = editor.getHTML(); },
  onUpdate: ({ editor }) => drafts.mark(draftId, editor.getHTML() !== baseline.current),
  editorProps: { attributes: { role: 'textbox', 'aria-label': 'Contenido de la nota conectada', 'aria-multiline': 'true' },
   handleClick: (_view, _pos, event) => { if ((event.target as Element).closest('a')) { event.preventDefault(); return true; } return false; } },
 });
 // TipTap's create event is deferred. Capture before the first visible edit, not after it.
 useLayoutEffect(() => { if (editor && !baseline.current) baseline.current = editor.getHTML(); }, [editor]);
 useEffect(() => () => drafts.mark(draftId, false), [drafts, draftId]);
 useEffect(() => { editor?.setEditable(!locked); }, [editor, locked]);
 useEffect(() => {
  if (!editor) return;
  const warn = () => setNotice('El contenido nativo protegido se conserva sin cambios.');
  editor.view.dom.addEventListener('note-native-protected', warn);
  return () => editor.view.dom.removeEventListener('note-native-protected', warn);
 }, [editor]);
 async function verify() {
  if (!submitted.current) throw new UnconfirmedWriteError('unknown');
  const fresh = (await transport.call<Note>('notes', 'get', { id: note.id })).data;
  if (fresh.id !== note.id || fresh.sync?.state !== 'synced') throw new UnconfirmedWriteError('provider');
  const controls = (await transport.call<Authority>('notes', 'editable_units', { id: note.id })).data;
  if (!controls.enabled || controls.local_revision !== fresh.sync.local_revision) throw new UnconfirmedWriteError('provider');
  const operations = notion ? notionEditorChanges(baseline.current, submitted.current, authority as NotionEditorAuthority) : oneNoteEditorChanges(baseline.current, submitted.current, authority as OneNoteEditorAuthority);
  const identities = notion ? notionEditorIdentityMap(submitted.current, authority as NotionEditorAuthority, controls as NotionEditorAuthority, operations.some(op => op.op === 'insert_unit' || op.op === 'delete_unit'))
   : oneNoteEditorIdentityMap(submitted.current, fresh.content);
  const check = new Editor({ extensions: extensions(notion, false), content: prepare(fresh, controls, notion), editable: false });
  try {
   const expected = rebaseOneNoteEditorHtml(submitted.current, identities);
   const changes = notion ? notionEditorChanges(check.getHTML(), expected, controls as NotionEditorAuthority) : oneNoteEditorChanges(check.getHTML(), expected, controls as OneNoteEditorAuthority);
   if (changes.length) throw new UnconfirmedWriteError('provider');
  } finally { check.destroy(); }
  done();
 }
 return <SaveForm onCancel={cancel} onVerify={verify} onSave={async () => {
  if (!editor || !baseline.current) throw Error('El editor todavía está cargando.');
  const draft = editor.getHTML();
  const operations = notion ? notionEditorChanges(baseline.current, draft, authority as NotionEditorAuthority) : oneNoteEditorChanges(baseline.current, draft, authority as OneNoteEditorAuthority);
  if (!operations.length) { done(); return; }
  submitted.current = draft; editor.setEditable(false); setLocked(true);
  await transport.call('notes', 'sync_edit', { id: note.id, expected_local_revision: authority.local_revision, operations });
  try { await verify(); } catch { throw new UnconfirmedWriteError('provider'); }
 }}>
  <p>Se conservan los bloques nativos protegidos. Sólo se guardarán cambios compatibles con {notion ? 'Notion' : 'OneNote'}.</p>
  <div className="productivity-toolbar" role="toolbar" aria-label="Formato de la nota">{editor && [
   { label: 'Negrita', icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
   { label: 'Cursiva', icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
   { label: 'Subrayado', icon: Underline, run: () => editor.chain().focus().toggleUnderline().run() },
   { label: 'Tachado', icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run() },
   { label: 'Deshacer', icon: Undo2, run: () => editor.chain().focus().undo().run() },
   { label: 'Rehacer', icon: Redo2, run: () => editor.chain().focus().redo().run() },
  ].map(({ label, icon: Icon, run }) => <button type="button" disabled={locked} aria-label={label} title={label} key={label} onClick={run}><Icon size={16} /></button>)}</div>
  <EditorContent editor={editor} className="productivity-note-editor"
   onClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault(); }}
   onAuxClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault(); }}
   onKeyDownCapture={event => { if (event.key === 'Enter' && (event.target as Element).closest('a')) event.preventDefault(); }} />
  {notice && <p role="status">{notice}</p>}
 </SaveForm>;
}

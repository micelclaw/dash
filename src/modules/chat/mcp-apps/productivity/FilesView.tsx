import { useState } from 'react';
import type { FileRecord } from '@/types/files';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, Origin, QueryState, SaveForm, Search } from './shared';
import { NoteContent } from './NoteContent';
import VfsFilesView from './VfsFilesView';
import { pageOffset, pageSize } from './selection-adapters';
import { filePreviewKind, RasterPreview } from './file-preview';

type Activity = { ts: string; type: string; actor: { kind: string; name?: string }; detail: { summary?: string } };
type Version = { id: string; version: number; size_bytes: number; created_at: string };
function FileDetail({ file, transport, refresh }: { file: FileRecord; transport: ProductivityTransport; refresh(): void }) {
 const [editing, setEditing] = useState(false); const [filename, setFilename] = useState(file.filename);
 const kind = filePreviewKind(file.mime_type);
 const content = useProductivityQuery(`file-content:${file.id}:${kind}`, async signal => {
  if (!kind || file.is_directory) return null;
  return (await transport.call<{ content_text?: string; truncated?: boolean; mime_type?: string; data_url?: string }>('files', kind === 'image' ? 'preview_image' : 'content', { id: file.id }, signal)).data;
 });
 const activity = useProductivityQuery(`file-activity:${file.id}`, async signal => (await transport.call<Activity[]>('files', 'activity', { id: file.id, limit: 25 }, signal)).data);
 const versions = useProductivityQuery(`file-versions:${file.id}`, async signal => (await transport.call<Version[]>('files', 'versions', { id: file.id, limit: 25 }, signal)).data);
 return <article aria-label="Ficha del archivo"><h2>{file.filename}</h2><Origin entity={file} /><Fields values={[["Tipo", file.mime_type], ["Tamaño", `${file.size_bytes} bytes`], ["Carpeta", file.parent_folder]]} />
  {editing ? <SaveForm onCancel={() => setEditing(false)} onSave={async () => { await transport.call('files', 'update', { id: file.id, filename }); setEditing(false); refresh(); }}><label>Nombre<input required value={filename} onChange={e => setFilename(e.target.value)} /></label></SaveForm> : <button onClick={() => setEditing(true)}>Editar ficha</button>}
  <section aria-label="Previsualización"><h3>Contenido</h3>{kind ? <QueryState {...content} retry={content.refresh}>{content.data && (kind === 'image' ? <RasterPreview name={file.filename} source={content.data.data_url} /> : <><NoteContent note={{ content: content.data.content_text ?? '', content_format: kind === 'markdown' ? 'markdown' : 'plain' }} />{content.data.truncated && <p role="status">La previsualización está recortada por el límite del módulo Archivos.</p>}</>)}</QueryState> : <p>Este formato no tiene previsualización en esta entrega.</p>}</section>
  <section><h3>Actividad</h3><QueryState {...activity} empty={!activity.data?.length} retry={activity.refresh}>{activity.data?.map((row, index) => <p key={`${row.ts}:${index}`}>{row.detail?.summary || row.type} · {row.actor?.name || (row.actor?.kind === 'agent' ? 'Agente' : 'Usuario')} · {row.ts}</p>)}</QueryState></section>
  <section><h3>Versiones</h3><QueryState {...versions} empty={!versions.data?.length} retry={versions.refresh}>{versions.data?.map(row => <p key={row.id}>Versión {row.version} · {row.created_at} · {row.size_bytes} bytes</p>)}</QueryState></section>
 </article>;
}
export default function FilesView(props: { context: ProductivityContext; transport: ProductivityTransport }) {
 return ['browse', 'search', 'stat', 'read', 'preview_path_image'].includes(props.context.selection.action) ? <VfsFilesView {...props} /> : <IndexedFilesView {...props} />;
}
function IndexedFilesView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [folder, setFolder] = useState(String(context.selection.params.folder || '')); const [offset, setOffset] = useState(() => pageOffset(context));
 const [id, setId] = useState(['get', 'content', 'activity', 'versions', 'preview_image'].includes(context.selection.action) ? String(context.selection.params.id) : '');
 const limit = pageSize(context); const filters = context.selection.action === 'list' ? context.selection.params : {};
 const list = useProductivityQuery(`files:${search}:${folder}:${offset}`, async signal => pageOf(await transport.call<FileRecord[]>('files', 'list', { ...filters, search, ...(folder ? { folder } : {}), limit, offset }, signal), limit));
 const detail = useProductivityQuery(`file:${id}`, async signal => id ? (await transport.call<FileRecord>('files', 'get', { id }, signal)).data : null);
 return <><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} /><label>Carpeta<input value={folder} onChange={e => { setFolder(e.target.value); setOffset(0); }} /></label>
  <div className="productivity-split"><section aria-label="Archivos de la carpeta"><QueryState {...list} empty={!list.data?.items.length} retry={list.refresh}>
   {list.data?.items.map(file => <button className="productivity-list-row" key={file.id} onClick={() => file.is_directory ? (setFolder(file.filepath), setOffset(0)) : setId(file.id)}><strong>{file.filename}</strong><span>{file.is_directory ? 'Carpeta' : file.mime_type}</span><Origin entity={file} /></button>)}<More offset={offset} limit={limit} hasMore={list.data?.hasMore ?? false} onChange={setOffset} />
  </QueryState></section><QueryState {...detail} retry={detail.refresh}>{detail.data ? <FileDetail key={detail.data.id} file={detail.data} transport={transport} refresh={() => { detail.refresh(); list.refresh(); }} /> : <p>Selecciona un archivo para consultar su ficha.</p>}</QueryState></div>
 </>;
}

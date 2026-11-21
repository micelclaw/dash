import { useState } from 'react';
import type { OriginEntity } from '@/types/origins';
import type { ProductivityContext, ProductivityTransport } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, Origin, QueryState, Search } from './shared';
import { NoteContent } from './NoteContent';
import { filePreviewKind, RasterPreview } from './file-preview';

interface Node extends OriginEntity { name: string; path: string; type: 'file' | 'directory'; size: number | null; mime_type: string | null; modified_at: string | null; is_read_only: boolean }
export default function VfsFilesView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const initialPath = String(context.selection.params.path || '/'); const isFile = ['read', 'stat', 'preview_path_image'].includes(context.selection.action);
 const [path, setPath] = useState(isFile ? initialPath.slice(0, initialPath.lastIndexOf('/')) || '/' : initialPath);
 const [search, setSearch] = useState(context.selection.action === 'search' ? String(context.selection.params.q || '') : ''); const [offset, setOffset] = useState(0);
 const [selected, setSelected] = useState(isFile ? initialPath : '');
 const list = useProductivityQuery(`vfs:${path}:${search}`, async signal => (await transport.call<Node[]>('files', search ? 'search' : 'browse', { path, ...(search ? { q: search } : {}) }, signal)).data);
 const detail = useProductivityQuery(`vfs-stat:${selected}`, async signal => selected ? (await transport.call<Node>('files', 'stat', { path: selected }, signal)).data : null);
 const content = useProductivityQuery(`vfs-read:${selected}:${detail.data?.mime_type}`, async signal => {
  const node = detail.data; const kind = filePreviewKind(node?.mime_type || ''); if (!node || node.type !== 'file' || !kind) return null;
  if (kind === 'image') return { kind, image: (await transport.call<{ data_url?: string }>('files', 'preview_path_image', { path: selected }, signal)).data };
  if (typeof node.size !== 'number' || !Number.isSafeInteger(node.size) || node.size < 0 || node.size > 1_000_000) return { kind: 'blocked' as const, reason: 'No se puede previsualizar este texto dentro del límite de lectura. Hace falta un tamaño conocido de hasta 1 MB.' };
  return { kind, text: (await transport.call<string>('files', 'read', { path: selected }, signal)).data };
 });
 const node = detail.data;
 return <><p>Carpeta: {path}</p><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} />
  <div className="productivity-split"><section aria-label="Carpeta del origen"><QueryState {...list} empty={!list.data?.length} retry={list.refresh}>
   {list.data?.slice(offset, offset + 25).map(row => <button className="productivity-list-row" key={row.path} onClick={() => row.type === 'directory' ? (setPath(row.path), setOffset(0)) : setSelected(row.path)}><strong>{row.name}</strong><span>{row.type === 'directory' ? 'Carpeta' : row.mime_type}</span><Origin entity={row} /></button>)}<More offset={offset} hasMore={(list.data?.length || 0) > offset + 25} onChange={setOffset} />
  </QueryState></section><article aria-label="Archivo del origen"><QueryState {...detail} retry={detail.refresh}>{node ? <><h2>{node.name}</h2><Origin entity={node} /><Fields values={[["Tipo", node.mime_type], ["Tamaño", node.size === null ? 'Sin datos' : `${node.size} bytes`], ["Modificado", node.modified_at]]} />
   {filePreviewKind(node.mime_type || '') ? <QueryState {...content} retry={content.refresh}>{content.data?.kind === 'blocked' ? <p role="status">{content.data.reason}</p> : content.data?.kind === 'image' ? <RasterPreview name={node.name} source={content.data.image?.data_url} /> : typeof content.data?.text === 'string' && <NoteContent note={{ content: content.data.text, content_format: content.data.kind === 'markdown' ? 'markdown' : 'plain' }} />}</QueryState> : <p>Este formato no tiene previsualización en esta entrega.</p>}
  </> : <p>Selecciona un archivo de la carpeta.</p>}</QueryState></article></div>
 </>;
}

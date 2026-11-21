import { useState } from 'react';
import type { Note } from '@/types/notes';
import type { ProductivityTransport } from './types';
import { More, Origin, QueryState } from './shared';
import { useProductivityQuery } from './use-productivity-query';

interface RelatedPage { items: Note[]; has_more: boolean; offset: number; limit: number }
export function RelatedNotes({ id, transport, select, limit = 10, initialOffset = 0 }: { id: string; transport: ProductivityTransport; select(id: string): void; limit?: number; initialOffset?: number }) {
 const [offset, setOffset] = useState(initialOffset);
 const query = useProductivityQuery(`related-notes:${id}:${offset}`, async signal => (await transport.call<RelatedPage>('notes', 'related', { id, limit, offset }, signal)).data);
 return <section aria-label="Notas relacionadas"><h3>Notas relacionadas</h3><QueryState {...query} retry={query.refresh}>
  {query.data?.items.length ? query.data.items.map(note => <button type="button" className="productivity-list-row" key={note.id} onClick={() => select(note.id)}><strong>{note.title || 'Sin título'}</strong><Origin entity={note} /></button>) : <p>No hay notas relacionadas accesibles en esta página.</p>}
  <More offset={offset} limit={limit} hasMore={query.data?.has_more ?? false} onChange={setOffset} />
 </QueryState></section>;
}

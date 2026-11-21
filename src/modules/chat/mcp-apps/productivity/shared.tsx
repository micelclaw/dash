import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SourceBadgeText } from '@/components/shared/SourceBadgeText';
import type { OriginEntity } from '@/types/origins';
import { RefreshCw } from 'lucide-react';
import { DraftsContext } from './drafts';
import { UnconfirmedWriteError } from './write-outcome';

export function QueryState({ loading, error, empty, retry, children }: { loading: boolean; error?: string; empty?: boolean; retry(): void; children: ReactNode }) {
 if (loading) return <p role="status">Cargando…</p>;
 if (error) return <div role="alert"><p>{error}</p><button onClick={retry}>Volver a consultar</button></div>;
 if (empty) return <p role="status">No hay resultados para esta consulta.</p>;
 return <>{children}</>;
}
export function Search({ initial = '', onSearch, busy = false }: { initial?: string; onSearch(value: string): void; busy?: boolean }) {
 const [query, setQuery] = useState(initial);
 return <form className="productivity-toolbar" onSubmit={event => { event.preventDefault(); onSearch(query); }}>
  <label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><button disabled={busy}>Buscar</button>
 </form>;
}
export function Origin({ entity }: { entity?: OriginEntity & { source?: string | null } }) {
 return <SourceBadgeText entity={entity} />;
}
export function Refresh({ onClick }: { onClick(): void }) { return <button type="button" onClick={onClick} aria-label="Actualizar consulta"><RefreshCw size={16} /></button>; }
export function More({ offset, hasMore, onChange, limit = 25 }: { offset: number; hasMore: boolean; onChange(offset: number): void; limit?: number }) {
 return <nav aria-label="Paginación" className="productivity-toolbar"><button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Anterior</button>
  <span>Página {Math.floor(offset / limit) + 1}</span><button disabled={!hasMore} onClick={() => onChange(offset + limit)}>Siguiente</button></nav>;
}
export function Fields({ values }: { values: Array<[string, ReactNode]> }) { return <dl className="productivity-fields">{values.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? 'Sin datos'}</dd></div>)}</dl>; }
export function SelectedDetail({ id, label, children }: { id: string; label: string; children: ReactNode }) {
 const element = useRef<HTMLElement>(null);
 useLayoutEffect(() => { element.current?.scrollIntoView({ block: 'start' }); }, [id]);
 return <article ref={element} aria-label={label}>{children}</article>;
}
/** No effects or auto-save. A failed save preserves the draft and never retries a write automatically. */
export function SaveForm({ onSave, onVerify, onCancel, children }: { onSave(): Promise<void>; onVerify?(): Promise<void>; onCancel(): void; children: ReactNode }) {
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const [held, setHeld] = useState(false);
 const drafts = useContext(DraftsContext); const draftId = useId();
 useEffect(() => () => drafts.mark(draftId, false), [drafts, draftId]);
 async function submit(event: FormEvent) {
  event.preventDefault(); if (busy || held) return; setBusy(true); setError(''); drafts.mark(draftId, true);
  try { await onSave(); drafts.mark(draftId, false); } catch (error) { if (error instanceof UnconfirmedWriteError) setHeld(true); setError(error instanceof Error ? error.message : 'No se pudo confirmar el guardado. Tu borrador sigue aquí.'); }
  finally { setBusy(false); }
 }
 async function verify() {
  if (busy || !held || !onVerify) return;
  setBusy(true);
  try { await onVerify(); drafts.mark(draftId, false); } catch (error) { setError(error instanceof Error ? error.message : 'El cambio todavía no está confirmado. Tu borrador sigue aquí.'); }
  finally { setBusy(false); }
 }
 return <form onSubmit={submit} onChangeCapture={() => drafts.mark(draftId, true)}><fieldset disabled={busy || held}>{children}</fieldset><div className="productivity-toolbar"><button type="submit" disabled={busy || held}>{busy ? 'Guardando…' : held ? 'Pendiente de confirmar' : 'Guardar'}</button>{held && onVerify && <button type="button" disabled={busy} onClick={() => void verify()}>Consultar estado del guardado</button>}<button type="button" disabled={busy} onClick={() => { drafts.mark(draftId, false); onCancel(); }}>{held ? 'Cerrar borrador' : 'Cancelar'}</button></div>{error && <p role="alert">{error}</p>}</form>;
}

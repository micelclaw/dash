import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Archive, Loader2, MessageSquare, Plus, RefreshCw, Settings2, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { sessionsBoardApi as service, type SessionSnapshot } from './sessions-board.service';
import { useSessionsBoardStore } from './sessions-board.store';
import { SessionsBoardEditor } from './SessionsBoardEditor';
import { sessionBoardColor } from './sessions-board-colors';

export function SessionsBoardPanel() {
  const owner = useAuthStore(state => state.user?.id), client = useWebSocketStore(state => state.client), connection = useWebSocketStore(state => state.status);
  const board = useSessionsBoardStore(), navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [creationKey, setCreationKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(''), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [confirmDelete, setConfirmDelete] = useState(false), [editing, setEditing] = useState<SessionSnapshot | null>(null);
  const revision = useRef<string | null>(null), lastRead = useRef(0);
  useEffect(() => { setEditing(null); setConfirmDelete(false); }, [board.selected]);
  useEffect(() => { if (!board.snapshot && board.error) setEditing(null); }, [board.snapshot, board.error]);
  useEffect(() => { setEditing(null); setConfirmDelete(false); if (owner) void useSessionsBoardStore.getState().initialize(owner); else useSessionsBoardStore.getState().reset(null); return () => useSessionsBoardStore.getState().reset(null); }, [owner]);
  useEffect(() => {
    const timer = window.setInterval(() => { lastRead.current = Date.now(); void useSessionsBoardStore.getState().refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (connection === 'connected') void useSessionsBoardStore.getState().refresh(true);
    return client?.on('workboard.sessions.changed', event => {
      const payload = event.data as { board_id?: string; revision?: string; revoked?: boolean } | undefined;
      if (payload?.board_id !== useSessionsBoardStore.getState().selected) return;
      if (payload?.revoked) { const state = useSessionsBoardStore.getState(); useSessionsBoardStore.setState({ snapshot: null, request: state.request + 1, error: 'Se ha retirado el acceso a este tablero.' }); return; }
      if (!payload?.revision || payload.revision === revision.current) return;
      revision.current = payload.revision;
      if (Date.now() - lastRead.current >= 5000) { lastRead.current = Date.now(); void useSessionsBoardStore.getState().refresh(); }
    });
  }, [client, connection]);
  const action = async (run: () => Promise<unknown>, message?: string) => {
    setBusy(true); try { await run(); if (message) toast.success(message); await useSessionsBoardStore.getState().refresh(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.'); } finally { setBusy(false); }
  };
  const snapshot = board.snapshot;
  const sortedBoards = [...board.boards].sort((a, b) => (board.pins.indexOf(a.id) < 0 ? 1000 : board.pins.indexOf(a.id)) - (board.pins.indexOf(b.id) < 0 ? 1000 : board.pins.indexOf(b.id)));
  const agentIds = [...new Set([...board.agents.map(agent => agent.id), ...(snapshot?.sessions.map(session => session.agent_id) ?? []), ...(board.view.agent_id ? [board.view.agent_id] : [])])];
  return <div className="flex min-w-0 flex-col gap-4" data-testid="sessions-board-panel">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold">Tableros de conversaciones</h3><p className="text-xs text-[var(--text-muted)]">Estado de tus sesiones, agrupado por reglas y colocación manual.</p></div><SourceBadge source="OpenClaw · Workboard" detail /></div>
    <div className="flex flex-wrap gap-2" aria-label="Tableros">{sortedBoards.map(item => <span key={item.id} className="inline-flex max-w-full items-center rounded-lg border border-[var(--border)]">
      <Button variant={board.selected === item.id ? 'secondary' : 'ghost'} disabled={Boolean(editing) || busy} onClick={() => { setConfirmDelete(false); void board.select(item.id); }}><span className="max-w-48 truncate">{item.icon} {item.name}{item.archived ? ' · archivado' : ''}</span></Button>
      <Button variant="ghost" aria-label={`${board.pins.includes(item.id) ? 'Desfijar' : 'Fijar'} ${item.name}`} onClick={() => void board.pin(item.id)}><Star size={14} fill={board.pins.includes(item.id) ? 'currentColor' : 'none'} /></Button>
    </span>)}<Button variant="outline" disabled={Boolean(editing)} onClick={() => { if (!creating) setCreationKey(crypto.randomUUID()); setCreating(value => !value); }}><Plus size={14} /> Tablero</Button></div>
    {creating && <form className="flex flex-wrap gap-2 rounded-lg border border-[var(--border)] p-3" onSubmit={event => { event.preventDefault(); if (!name.trim() || !owner) return; void action(async () => { const created = await service.create(name.trim(), creationKey); setName(''); setCreating(false); setCreationKey(crypto.randomUUID()); await useSessionsBoardStore.getState().initialize(owner); await useSessionsBoardStore.getState().select(created.id); }, 'Tablero creado'); }}>
      <Input aria-label="Nombre del nuevo tablero" className="min-w-44 flex-1" placeholder="Por ejemplo: Mi trabajo de hoy" maxLength={100} value={name} onChange={event => setName(event.target.value)} /><Button disabled={busy || !name.trim()} type="submit">Crear tablero de conversaciones</Button><Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
    </form>}
    {board.error && <div role="alert" className="rounded-lg border border-[var(--error)] p-3 text-sm">{board.error}<Button variant="ghost" onClick={() => owner && void board.initialize(owner)}>Volver a cargar</Button></div>}
    {board.loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Cargando tablero…</p>}
    {!board.loading && !board.error && !board.boards.length && <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">Crea un tablero para organizar tus conversaciones. Las conversaciones seguirán disponibles en el chat.</p>}
    {snapshot && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="border-l-2 pl-2 font-semibold" style={{ borderLeftColor: sessionBoardColor(snapshot.board.color) ?? 'var(--amber)' }}>{snapshot.board.icon} {snapshot.board.name}</h4><span className="text-xs text-[var(--text-muted)]">{snapshot.sessions.length} conversaciones visibles</span></div><div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || Boolean(editing)} onClick={() => setEditing(structuredClone(snapshot))}><Settings2 size={14} /> Editar</Button>
        <Button variant="outline" disabled={busy} onClick={() => void action(() => service.archive(board.selected, !snapshot.board.archived), snapshot.board.archived ? 'Tablero restaurado' : 'Tablero archivado')}><Archive size={14} />{snapshot.board.archived ? 'Restaurar' : 'Archivar'}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Eliminar</Button>
        <Button variant="ghost" aria-label="Actualizar tablero" onClick={() => void board.refresh(true)}><RefreshCw size={14} /></Button>
      </div></div>
      {confirmDelete && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--error)] p-3 text-sm"><span>¿Eliminar «{snapshot.board.name}»? Tus conversaciones se conservan.</span><Button variant="destructive" disabled={busy} onClick={() => void action(async () => { await service.remove(board.selected); setConfirmDelete(false); if (owner) await board.initialize(owner); }, 'Tablero eliminado')}>Eliminar este tablero</Button><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button></div>}
      {editing ? <SessionsBoardEditor key={editing.board.id} snapshot={editing} agents={board.agents} onSaved={() => { setEditing(null); void board.refresh(true); }} onCancel={() => setEditing(null)} /> : <>
        <div className="flex flex-wrap gap-2" aria-label="Filtros de conversaciones"><Button variant={board.view.involving_me || board.view.person_id ? 'outline' : 'secondary'} onClick={() => void board.setView({ ...board.view, involving_me: false, person_id: null })}>Todas</Button><Button variant={board.view.involving_me ? 'secondary' : 'outline'} onClick={() => void board.setView({ ...board.view, involving_me: true, person_id: null })}>Participo yo</Button>{(snapshot.people ?? []).map(person => <Button key={person.id} variant={board.view.person_id === person.id ? 'secondary' : 'outline'} onClick={() => void board.setView({ ...board.view, involving_me: false, person_id: person.id })}>{person.label}</Button>)}<span className="mx-1 border-l border-[var(--border)]" /><Button variant={!board.view.agent_id ? 'secondary' : 'outline'} onClick={() => void board.setView({ ...board.view, agent_id: null })}>Todos los agentes</Button>{agentIds.map(id => <Button key={id} variant={board.view.agent_id === id ? 'secondary' : 'outline'} onClick={() => void board.setView({ ...board.view, agent_id: id })}>{board.agents.find(agent => agent.id === id)?.label ?? id.split('--').at(-1)}</Button>)}</div>
        <Input aria-label="Buscar conversación en el tablero" placeholder="Buscar conversaciones…" value={query} onChange={event => setQuery(event.target.value)} /><div className="flex max-w-full gap-3 overflow-x-auto pb-3" data-testid="sessions-columns">{snapshot.columns.map(column => <section key={column.id} className="min-w-64 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" style={{ borderTopColor: sessionBoardColor(column.color), borderTopWidth: column.color ? 3 : 1 }} aria-label={column.label}>
          <h5 className="mb-1 flex items-center justify-between gap-2 font-medium"><span>{column.label}</span><span className="text-xs text-[var(--text-muted)]">{snapshot.sessions.filter(session => session.column_id === column.id && (!query || `${session.title} ${session.headline}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).length}</span></h5><p className="mb-3 text-xs text-[var(--text-muted)]">{column.description}</p>
          <div className="flex flex-col gap-3">{snapshot.sessions.filter(session => session.column_id === column.id && (!query || `${session.title} ${session.headline}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(session => <article key={session.conversation_id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <button className="w-full text-left text-sm font-medium text-[var(--text)]" onClick={() => navigate(`/chat?conversation=${encodeURIComponent(session.conversation_id)}`)}>{session.title}</button><p className="mt-1 text-xs text-[var(--text-muted)]">{session.agent_id.split('--').at(-1)} · {session.run === 'active' ? 'Trabajando' : session.health ?? 'En reposo'}</p>
            {session.headline && <p className="mt-2 text-xs">{session.headline}</p>}<p className="mt-2 text-xs text-[var(--text-muted)]">{session.source === 'operator' ? 'Colocación manual' : 'Según las reglas'}</p>
            {session.pull_requests.map(pr => <a className="mt-1 block text-xs text-[var(--amber)]" key={pr.url} href={pr.url} target="_blank" rel="noopener noreferrer">PR #{pr.number} · {pr.state}</a>)}
            <label className="mt-3 block text-xs text-[var(--text-muted)]">Mover a otra columna<select className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" aria-label={`Mover ${session.title}`} value={session.column_id} disabled={busy} onChange={event => void action(() => service.move(board.selected, session.conversation_id, event.target.value), 'Colocación guardada')}>{snapshot.columns.map(destination => <option key={destination.id} value={destination.id}>{destination.label}</option>)}</select></label>
          </article>)}</div>
        </section>)}</div>
        {!snapshot.sessions.length && <p className="text-sm text-[var(--text-muted)]">No hay conversaciones que coincidan con estos filtros.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div><h5 className="text-sm font-medium">Agente de este tablero</h5><p className="text-xs text-[var(--text-muted)]">Conversación dedicada para trabajar con las reglas y sesiones de este tablero.</p></div><Button variant="outline" disabled={busy} onClick={() => void action(async () => { const conversation = await service.agent(board.selected); navigate(`/chat?conversation=${encodeURIComponent(conversation)}`); })}><MessageSquare size={14} /> Abrir agente del tablero</Button></div>
      </>}
    </>}
  </div>;
}

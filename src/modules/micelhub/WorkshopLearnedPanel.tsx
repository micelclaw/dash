import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { workshopService as service, type WorkshopAgent, type WorkshopChange, type WorkshopRead, type WorkshopSnapshot } from './workshop.service';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';
export function WorkshopLearnedPanel({ onTeach }: { onTeach(agentName?: string): void }) {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const canConfigure = role === 'owner' || role === 'admin';
  const [agents, setAgents] = useState<WorkshopAgent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null);
  const [projectionSynced, setProjectionSynced] = useState(true);
  const [tab, setTab] = useState<'skills' | 'changes' | 'archived'>('skills');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedError, setFeedError] = useState('');
  const [changes, setChanges] = useState<WorkshopChange[]>([]);
  const [detail, setDetail] = useState<WorkshopRead | null>(null);
  const [detailVersion, setDetailVersion] = useState<string | undefined>();
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null);
  const generation = useRef(0);
  const requestId = useRef(0);
  const selected = agents.find((agent) => agent.id === agentId);
  const fail = (cause: unknown) => {
    if (cause instanceof ApiError && [401, 403, 404].includes(cause.status ?? 0)) { generation.current++; setSnapshot(null); setChanges([]); setDetail(null); setArchiveConfirm(null); setBusy(false); }
    setError(errorMessage(cause)); toast.error(errorMessage(cause));
  };
  useEffect(() => {
    let active = true; setAgents([]); setAgentId(''); setSnapshot(null); setChanges([]); setDetail(null); setError('');
    void service.agents().then((items) => { if (active) { setAgents(items); setAgentId(items[0]?.id ?? ''); setLoading(false); } }).catch((cause) => { if (active) { setError(errorMessage(cause)); setLoading(false); } });
    return () => { active = false; generation.current++; };
  }, [userId]);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!agentId) return; const current = generation.current; setLoading(true); setError('');
    try { const data = await service.learned(agentId, signal); if (current === generation.current && !signal?.aborted) { setSnapshot(data.workshop); setProjectionSynced(data.projection_synced); } }
    catch (cause) { if (current === generation.current && !signal?.aborted) { if (cause instanceof ApiError && [401, 403, 404].includes(cause.status ?? 0)) { setSnapshot(null); setChanges([]); setDetail(null); } setError(errorMessage(cause)); } }
    finally { if (current === generation.current && !signal?.aborted) setLoading(false); }
  }, [agentId]);
  useEffect(() => {
    generation.current++; requestId.current++; setSnapshot(null); setChanges([]); setDetail(null); setDetailVersion(undefined); setArchiveConfirm(null); setError(''); setFeedError(''); setBusy(false);
    const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); generation.current++; };
  }, [agentId, load]);
  async function loadChanges() {
    if (!agentId) return; const current = generation.current; setFeedError('');
    try { const feed = await service.changes(agentId); if (current === generation.current) setChanges(feed); }
    catch (cause) { if (current === generation.current) { if (cause instanceof ApiError && [401, 403, 404].includes(cause.status ?? 0)) fail(cause); else setFeedError(errorMessage(cause)); } }
  }
  useEffect(() => { if (tab === 'changes' && agentId) void loadChanges(); }, [tab, agentId]);
  async function openSkill(name: string, versionId?: string, filePath = 'SKILL.md') {
    const current = generation.current; const request = ++requestId.current; setBusy(true);
    try { const read = await service.skill(agentId, name, { file_path: filePath, ...(versionId ? { version_id: versionId } : {}) }); if (current === generation.current && request === requestId.current) { setDetail(read); setDetailVersion(versionId); } }
    catch (cause) { if (current === generation.current && request === requestId.current) fail(cause); }
    finally { if (current === generation.current && request === requestId.current) setBusy(false); }
  }
  async function mutate(name: string, action: 'archive' | 'restore', versionId?: string) {
    const current = generation.current; setBusy(true); setError('');
    try {
      const result = action === 'archive' ? await service.archive(agentId, name) : await service.restore(agentId, name, versionId);
      if (current !== generation.current) return;
      setArchiveConfirm(null); setDetail(null); setProjectionSynced(result.projection_synced);
      if (result.projection_synced) toast.success(action === 'archive' ? 'Habilidad archivada.' : 'Versión restaurada.');
      else toast.warning('Cambio confirmado en Workshop. La visibilidad del agente está pendiente de sincronizar.');
      await load(); if (tab === 'changes') await loadChanges();
    } catch (cause) { if (current === generation.current) fail(cause); }
    finally { if (current === generation.current) setBusy(false); }
  }
  const filter = (name: string) => name.toLowerCase().includes(query.toLowerCase());
  const archived = snapshot?.archived.filter((skill) => !skill.live) ?? [];
  const versions = snapshot?.archived.find((item) => item.name === detail?.name)?.versions ?? [];
  return <section className="space-y-4 text-sm leading-relaxed text-[var(--text-dim)]" aria-label="Habilidades aprendidas">
    <div><h3 className="text-sm font-semibold text-[var(--text)]">Aprendidas por agente</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Procedimientos que el aprendizaje autónomo ha instalado en este agente. Tu biblioteca personal se gestiona aparte.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Elegir agente">{agents.map((agent) => <Button key={agent.id} variant={agentId === agent.id ? 'secondary' : 'outline'} size="sm" onClick={() => setAgentId(agent.id)}>{agent.display_name || agent.name}</Button>)}</div>
    {!agents.length && !loading && <p className="text-sm text-muted-foreground">No hay agentes propios disponibles.</p>}
    {error && <p role="alert" className="rounded border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {snapshot && <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Aprendizaje automático global: <strong>{snapshot.mode === 'auto' ? 'Activado' : 'Desactivado'}</strong></p>{canConfigure && <Button variant="outline" size="sm" disabled={busy} onClick={() => { const current = generation.current; setBusy(true); void service.setMode(snapshot.mode === 'auto' ? 'off' : 'auto').then(() => { if (current === generation.current) void load(); }).catch((cause) => { if (current === generation.current) fail(cause); }).finally(() => { if (current === generation.current) setBusy(false); }); }}>{snapshot.mode === 'auto' ? 'Desactivar automático' : 'Activar automático'}</Button>}</div><p className="text-xs text-muted-foreground">{snapshot.mode === 'off' ? 'El aprendizaje autónomo está desactivado.' : 'La activación global no acredita la disponibilidad para este agente. La comprobación efectiva requiere el runtime, modelo, sandbox y política del turno.'}</p></div>}
    {!projectionSynced && <p role="status" className="rounded border border-amber-500/40 p-3 text-sm">El inventario nativo está actualizado; su acceso efectivo en el agente sigue sincronizándose. Actualiza para reintentar.</p>}
    <div className="flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-1" role="tablist" aria-label="Inventario de aprendidas">{(['skills', 'changes', 'archived'] as const).map((value) => <Button role="tab" aria-selected={tab === value} key={value} variant={tab === value ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab(value)}>{value === 'skills' ? 'Aprendidas' : value === 'changes' ? 'Cambios' : 'Archivadas'}</Button>)}</div><Button variant="outline" size="sm" onClick={() => { void load(); if (tab === 'changes') void loadChanges(); }} disabled={!agentId || busy} aria-label="Actualizar aprendidas"><RefreshCw size={14} /></Button></div>
    <Input aria-label="Buscar habilidad aprendida" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar habilidad…" />
    {loading ? <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Cargando aprendidas…</p> : <>
      {tab === 'skills' && <div className="divide-y rounded-lg border border-[var(--border)] bg-[var(--surface)]">{snapshot?.skills.filter((item) => filter(item.name)).map((item) => <div key={item.name} className="flex flex-wrap items-center gap-3 p-3"><BookOpen size={16} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-[var(--text)]">{item.name}</p><p className="text-xs text-muted-foreground">{item.description || 'Habilidad aprendida'} · {item.use_count ?? 0} usos{item.last_used_at_ms ? ` · ${new Date(item.last_used_at_ms).toLocaleDateString()}` : ''}</p></div><SourceBadge source="Workshop OpenClaw" /><Button variant="outline" size="sm" disabled={busy} onClick={() => void openSkill(item.name)}>Abrir</Button></div>)}{!snapshot?.skills.length && <p className="p-4 text-sm text-muted-foreground">Este agente aún no tiene habilidades aprendidas. Las habilidades que le enseñes desde un chat propio se publicarán en tu biblioteca personal.</p>}</div>}
      {tab === 'archived' && <div className="divide-y rounded-lg border border-[var(--border)] bg-[var(--surface)]">{archived.filter((item) => filter(item.name)).map((item) => <div key={item.name} className="flex flex-wrap items-center gap-3 p-3"><Archive size={16} /><span className="min-w-0 flex-1 break-words">{item.name}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => void openSkill(item.name, item.versions[0]?.id)}>Ver última versión</Button><Button size="sm" disabled={busy} onClick={() => void mutate(item.name, 'restore')}>Restaurar</Button></div>)}{!archived.length && <p className="p-4 text-sm text-muted-foreground">No hay habilidades archivadas. Las versiones de habilidades activas se consultan en su detalle.</p>}</div>}
      {tab === 'changes' && <div className="space-y-2">{feedError && <p role="alert" className="text-sm text-destructive">{feedError}</p>}{changes.filter((item) => filter(item.skill_name)).map((change) => <div className="flex flex-wrap items-center gap-3 rounded border p-3" key={change.id}><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-[var(--text)]">{change.skill_name} · {change.summary}</p><p className="text-xs text-muted-foreground">{change.actor} · {new Date(change.created_at_ms).toLocaleString()}</p></div><Button size="sm" variant="outline" disabled={busy || change.action !== 'create' && !change.version_id} onClick={() => void mutate(change.skill_name, change.action === 'create' ? 'archive' : 'restore', change.version_id)}>Deshacer cambio</Button></div>)}{!changes.length && !feedError && <p className="p-4 text-sm text-muted-foreground">No hay cambios recientes.</p>}</div>}
    </>}
    {detail && <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Detalle de habilidad aprendida"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium text-[var(--text)]">{detail.name}{detailVersion ? ' · Versión guardada' : ' · Actual'}</h4><Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Cerrar detalle</Button></div><div className="flex flex-wrap gap-2">{detail.files.map((name) => <Button key={name} size="sm" variant={name === detail.file_path ? 'secondary' : 'outline'} disabled={busy} onClick={() => void openSkill(detail.name, detailVersion, name)}>{name}</Button>)}</div><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">{detail.content}</pre>
      {versions.length > 0 && <div className="space-y-2"><h5 className="text-sm font-medium text-[var(--text)]">Versiones</h5>{versions.map((version) => <div key={version.id} className="flex flex-wrap items-center gap-2 text-xs"><code>{version.id}</code><Button size="sm" variant="outline" disabled={busy} onClick={() => void openSkill(detail.name, version.id)}>Ver</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate(detail.name, 'restore', version.id)}>Restaurar esta versión</Button></div>)}</div>}
      {!detailVersion && <Button variant="destructive" size="sm" disabled={busy} onClick={() => setArchiveConfirm(detail.name)}>Archivar habilidad</Button>}
    </section>}
    {archiveConfirm && <div role="alert" className="space-y-2 rounded border border-amber-500/40 p-3 text-sm"><p>Archivar {archiveConfirm} retira solo su copia Workshop. Una copia homónima del workspace puede seguir disponible.</p><div className="flex gap-2"><Button variant="destructive" size="sm" disabled={busy} onClick={() => void mutate(archiveConfirm, 'archive')}>Confirmar archivo</Button><Button variant="outline" size="sm" onClick={() => setArchiveConfirm(null)}>Cancelar</Button></div></div>}
    <Button variant="outline" onClick={() => onTeach(selected?.name)}>Enseñar en un chat propio</Button>
  </section>;
}

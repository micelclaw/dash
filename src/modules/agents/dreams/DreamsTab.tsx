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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Brain, BookOpen, Globe, Loader2, RefreshCw, Search, Settings2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { api } from '@/services/api';
import { useDreams } from './useDreams';
import { DreamScene } from './DreamScene';
import { AgentMemory } from '../AgentMemory';
import { DreamDiary } from './DreamDiary';
import { DreamAdvanced } from './DreamAdvanced';
import { dimText, dreamBtn } from './shared';
import type { ManagedAgent } from '../types';

type Face = 'scene' | 'diary' | 'advanced';
type MemoryFace = 'overview' | 'memories' | 'dreams' | 'settings';

interface Props { agents: ManagedAgent[] }

const LS_AGENT = 'dreams-agent';

type MemorySourcePreview = {
  path: string;
  content: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  truncated: boolean;
  has_more: boolean;
};

export function DreamsTab({ agents }: Props) {
  const isMobile = useIsMobile();
  const [face, setFace] = useState<Face>('scene');
  const [memoryFace, setMemoryFace] = useState<MemoryFace>(() => {
    if (typeof window === 'undefined') return 'overview';
    const tab = new URLSearchParams(window.location.search).get('memory_tab');
    return tab === 'dreams' || tab === 'memories' || tab === 'settings' ? tab : 'overview';
  });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [sourcePreview, setSourcePreview] = useState<{ index: number; data: MemorySourcePreview } | null>(null);
  const [sourceLoadingIndex, setSourceLoadingIndex] = useState<number | null>(null);
  const [sourceError, setSourceError] = useState<{ index: number; message: string } | null>(null);
  const sourceRequest = useRef(0);

  // Selección de agente: último usado (localStorage) → francis → primero.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_AGENT); } catch { return null; }
  });
  const agent = useMemo(() => {
    const byId = agents.find(a => a.id === selectedId);
    if (byId) return byId;
    return agents.find(a => a.name === 'francis') ?? agents[0] ?? null;
  }, [agents, selectedId]);

  const selectAgent = (id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(LS_AGENT, id); } catch { /* ignore */ }
  };

  const d = useDreams(agent?.id ?? null);
  const dreamingOn = (d.dreamCfg?.enabled ?? d.status?.dreaming?.enabled ?? false) === true;
  const active = dreamingOn && d.dreamCfg?.memory_core_enabled !== false;

  useEffect(() => {
    setQuery('');
    setResults([]);
    setSearchError(null);
    setSourcePreview(null);
    setSourceError(null);
    setSourceLoadingIndex(null);
    sourceRequest.current++;
  }, [agent?.id]);

  const searchMemory = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !agent) return;
    setSearching(true);
    setSearchError(null);
    setSourcePreview(null);
    setSourceError(null);
    sourceRequest.current++;
    try {
      const response = await api.get<{ data: { results?: Array<Record<string, unknown>> } }>(
        `/managed-agents/${agent.id}/memory/search`,
        { query: trimmed, max_results: 12, min_score: 0.3 },
      );
      setResults(Array.isArray(response.data.results) ? response.data.results : []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'No se pudo buscar en la memoria');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [agent, query]);

  const openMemorySource = useCallback(async (index: number, path: string, startLine: number) => {
    if (!agent) return;
    const requestId = ++sourceRequest.current;
    setSourceLoadingIndex(index);
    setSourceError(null);
    try {
      const response = await api.get<{ data: MemorySourcePreview }>(
        `/managed-agents/${agent.id}/memory/source`,
        { path, line_start: startLine, line_end: startLine + 199 },
      );
      if (sourceRequest.current === requestId) setSourcePreview({ index, data: response.data });
    } catch (error) {
      if (sourceRequest.current === requestId) {
        setSourceError({ index, message: error instanceof Error ? error.message : 'No se pudo abrir la fuente' });
      }
    } finally {
      if (sourceRequest.current === requestId) setSourceLoadingIndex(null);
    }
  }, [agent]);

  if (!agent) {
    return <div style={{ ...dimText, padding: 24 }}>No hay agentes.</div>;
  }

  const faceBtn = (key: Face, label: string) => (
    <button key={key} onClick={() => setFace(key)}
      style={{
        flex: isMobile ? 1 : undefined, padding: isMobile ? '9px 12px' : '6px 14px',
        minHeight: isMobile ? 40 : undefined, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${face === key ? 'var(--amber)' : 'var(--border)'}`,
        background: face === key ? 'var(--bg-subtle, rgba(127,127,127,0.12))' : 'transparent',
        color: face === key ? 'var(--text)' : 'var(--text-dim)',
        fontSize: '0.76rem', fontWeight: face === key ? 600 : 400,
      }}>{label}</button>
  );

  const memoryFaceBtn = (key: MemoryFace, label: string, Icon: typeof Brain) => (
    <button key={key} onClick={() => setMemoryFace(key)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        flex: isMobile ? 1 : undefined, padding: isMobile ? '9px 10px' : '7px 12px',
        minHeight: isMobile ? 40 : undefined, borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
        border: `1px solid ${memoryFace === key ? 'var(--amber)' : 'var(--border)'}`,
        background: memoryFace === key ? 'var(--amber-dim)' : 'transparent',
        color: memoryFace === key ? 'var(--amber)' : 'var(--text-dim)',
        fontSize: '0.76rem', fontWeight: memoryFace === key ? 600 : 400,
      }}><Icon size={14} />{label}</button>
  );

  const dreaming = d.status?.dreaming ?? {};
  const phase = dreaming.phases ?? {};
  const embedding = d.status?.embedding ?? {};
  const statusText = d.error ? 'Requiere atención' : d.loading ? 'Despertando' : dreaming.enabled ? 'Despierto' : 'Hibernando';
  const lastDreamAt = dreaming.last_promoted_at;
  const lastDream = typeof lastDreamAt === 'string' || typeof lastDreamAt === 'number'
    ? new Date(lastDreamAt).toLocaleString()
    : 'Sin datos todavía';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>Memory</h3>
        {!isMobile && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>memoria activa y consolidación durante el sueño</span>}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.64rem', fontWeight: 700,
          letterSpacing: '0.04em', padding: '2px 9px', borderRadius: 999,
          border: `1px solid ${active ? 'var(--success)' : 'var(--border)'}`,
          color: active ? 'var(--success)' : 'var(--text-muted)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--success)' : 'var(--text-muted)' }} />
          {active ? 'SUEÑO ACTIVADO' : 'SUEÑO DESACTIVADO'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle global */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-dim)', cursor: 'pointer' }}
            title="Ajuste GLOBAL de OpenClaw memory-core — afecta a todos los agentes">
            <Globe size={12} />
            <MiniToggle on={dreamingOn} busy={d.togglingDream} disabled={!d.canManageGlobalMemory} onChange={v => void d.toggleDreaming(v)} />
            {!d.canManageGlobalMemory && <span>Solo lectura</span>}
          </label>
          <button onClick={d.refresh} disabled={d.refreshing} title="Actualizar" style={dreamBtn()}>
            {d.refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{!isMobile && ' Actualizar'}
          </button>
        </div>
      </div>

      {/* Selector de agente + subpestañas */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
        <select
          value={agent.id}
          onChange={e => selectAgent(e.target.value)}
          style={{
            fontSize: '0.78rem', padding: isMobile ? '9px 12px' : '6px 10px', minHeight: isMobile ? 42 : undefined,
            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
            maxWidth: isMobile ? undefined : 260,
          }}>
          {agents.map(a => <option key={a.id} value={a.id}>{a.avatar || '🤖'} {a.display_name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, marginLeft: isMobile ? 0 : 'auto', overflowX: 'auto' }}>
          {memoryFaceBtn('overview', 'Resumen', Brain)}
          {memoryFaceBtn('memories', 'Recuerdos', Search)}
          {memoryFaceBtn('dreams', 'Sueños', BookOpen)}
          {memoryFaceBtn('settings', 'Configuración', Settings2)}
        </div>
      </div>

      {/* Cuerpo */}
      {d.loading ? (
        <div style={{ ...dimText, display: 'flex', alignItems: 'center', gap: 8, padding: 32, justifyContent: 'center' }}>
          <Loader2 size={16} className="animate-spin" /> Leyendo el sueño de {agent.display_name}…
        </div>
      ) : d.error ? (
        <div style={{ border: '1px solid var(--error)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: '0.78rem' }}><AlertTriangle size={14} /> {d.error}</span>
          <button onClick={d.refresh} style={{ ...dreamBtn(), alignSelf: 'flex-start' }}><RefreshCw size={13} /> Reintentar</button>
        </div>
      ) : memoryFace === 'overview' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <MemoryCard title="Estado de Memory" icon={<Brain size={15} color="var(--amber)" />}>
            <StatusLine label="Estado" value={statusText} ok={statusText === 'Despierto'} />
            <StatusLine label="Motor" value={d.status?.provider ?? 'OpenClaw Memory'} />
            <StatusLine label="Índice" value={embedding.ok === true ? 'Actualizado' : embedding.checked === true ? 'Requiere atención' : 'Sin comprobar'} ok={embedding.ok === true} />
            <StatusLine label="Recuerdos activos" value={String(dreaming.short_term_count ?? dreaming.short_term_entries?.length ?? 0)} />
          </MemoryCard>
          <MemoryCard title="Ciclo de sueño" icon={<BookOpen size={15} color="var(--amber)" />}>
            <StatusLine label="Ligero" value={phase.light?.cron ?? 'No programado'} />
            <StatusLine label="REM" value={phase.rem?.cron ?? 'No programado'} />
            <StatusLine label="Profundo" value={phase.deep?.cron ?? 'No programado'} />
            <StatusLine label="Último sueño" value={lastDream} />
          </MemoryCard>
          <div style={{ gridColumn: isMobile ? undefined : '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Actividad reciente</span>
            <span style={{ ...dimText, padding: 0 }}>Último sueño: {lastDream}</span>
            <span style={{ ...dimText, padding: 0 }}>Promociones hoy: {dreaming.promoted_today ?? 0} · Señales: {dreaming.total_signal_count ?? 0}</span>
          </div>
        </div>
      ) : memoryFace === 'memories' ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchMemory(); }} placeholder={`Buscar recuerdos de ${agent.display_name}...`} style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', padding: '8px 10px', fontSize: '0.8rem' }} />
            <button onClick={() => void searchMemory()} disabled={searching || !query.trim()} style={{ ...dreamBtn(), justifyContent: 'center', opacity: searching || !query.trim() ? 0.6 : 1 }}>
              {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Buscar
            </button>
          </div>
          {searchError && <span style={{ color: 'var(--error)', fontSize: '0.76rem' }}>{searchError}</span>}
          {!searching && !searchError && results.length === 0 && <span style={{ ...dimText, padding: '18px 0' }}>Busca una frase, una preferencia o un tema para explorar los recuerdos de este agente.</span>}
          {results.map((result, index) => {
            const score = typeof result.score === 'number' ? result.score.toFixed(2) : '—';
            const source = typeof result.path === 'string' ? result.path : typeof result.source === 'string' ? result.source : 'Fuente de memoria';
            const sourcePath = typeof result.path === 'string' ? result.path : null;
            const transcript = sourcePath !== null && /^sessions\/(?:[^/]+\/)*[^/]+\.jsonl$/i.test(sourcePath);
            const snippet = typeof result.snippet === 'string' ? result.snippet : typeof result.text === 'string' ? result.text : 'Sin vista previa';
            const lines = [result.startLine ?? result.start_line, result.endLine ?? result.end_line].filter(v => typeof v === 'number').join('–');
            const hitStart = typeof result.start_line === 'number' ? result.start_line : typeof result.startLine === 'number' ? result.startLine : 1;
            const preview = sourcePreview?.index === index ? sourcePreview.data : null;
            return <div key={`${source}-${index}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.74rem' }}><span style={{ color: 'var(--success)', fontWeight: 700 }}>{score}</span><span style={{ color: 'var(--text)' }}>{source}</span>{lines && <span style={{ color: 'var(--text-muted)' }}>líneas {lines}</span>}</div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', lineHeight: 1.45 }}>{snippet}</span>
              {transcript ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Fragmento de sesión; el archivo completo no se abre desde Memory.</span> : sourcePath && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (preview) { sourceRequest.current++; setSourcePreview(null); return; }
                      void openMemorySource(index, sourcePath, Math.max(1, hitStart - 20));
                    }}
                    disabled={sourceLoadingIndex === index}
                    style={{ ...dreamBtn(), alignSelf: 'flex-start' }}
                  >{sourceLoadingIndex === index ? 'Abriendo…' : preview ? 'Cerrar fuente' : 'Abrir fuente'}</button>
                  {sourceError?.index === index && <span role="alert" style={{ color: 'var(--error)', fontSize: '0.74rem' }}>{sourceError.message}</span>}
                  {preview && <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: 10, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginRight: 'auto' }}>Líneas {preview.start_line}–{preview.end_line} de {preview.total_lines}</span>
                      <button type="button" style={dreamBtn()} disabled={preview.start_line <= 1} onClick={() => void openMemorySource(index, sourcePath, Math.max(1, preview.start_line - 200))}>Anterior</button>
                      <button type="button" style={dreamBtn()} disabled={!preview.has_more} onClick={() => void openMemorySource(index, sourcePath, preview.end_line + 1)}>Siguiente</button>
                    </div>
                    <pre style={{ margin: 0, color: 'var(--text)', fontSize: '0.74rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 360, overflow: 'auto' }}>{preview.content}</pre>
                    {preview.truncated && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Vista recortada por tamaño de seguridad.</span>}
                  </div>}
                </div>
              )}
            </div>;
          })}
        </div>
      ) : memoryFace === 'settings' ? (
        <AgentMemory agentId={agent.id} agentName={agent.display_name} agentBareName={agent.name} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
            {faceBtn('scene', 'Escena')}
            {faceBtn('diary', 'Diario')}
            {faceBtn('advanced', 'Avanzado')}
          </div>
          {face === 'scene' ? (
        <DreamScene
          agentName={agent.display_name}
          agentAvatar={agent.avatar ?? undefined}
          status={d.status?.dreaming}
          dreamCfg={d.dreamCfg}
          togglingDream={d.togglingDream}
          onToggleDreaming={v => void d.toggleDreaming(v)}
          onSaveConfig={d.saveDreamConfig}
          canManageGlobalMemory={d.canManageGlobalMemory}
        />
          ) : face === 'diary' ? (
        <DreamDiary
          agentName={agent.display_name}
          diary={d.diary}
          rem={d.rem}
          remLoading={d.remLoading}
          wikiStatus={d.wikiStatus}
          wikiInsights={d.wikiInsights}
          wikiPalace={d.wikiPalace}
          wikiLoading={d.wikiLoading}
          busy={d.busy}
          onLoadRem={d.loadRem}
          onLoadWiki={d.loadWiki}
          onEnableWiki={() => void d.enableWiki()}
          onMaintenance={(a, l) => void d.runMaintenance(a, l)}
        />
          ) : (
        <DreamAdvanced
          agentName={agent.display_name}
          status={d.status?.dreaming}
          diary={d.diary}
          rem={d.rem}
          remLoading={d.remLoading}
          busy={d.busy}
          onLoadRem={d.loadRem}
          onMaintenance={(a, l) => void d.runMaintenance(a, l)}
          />
          )}
        </>
      )}
    </div>
  );
}

function MemoryCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{icon}{title}</div>
    {children}
  </div>;
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.73rem' }}><span style={{ color: 'var(--text-dim)' }}>{label}</span><span style={{ color: ok === false ? 'var(--error)' : ok ? 'var(--success)' : 'var(--text)', textAlign: 'right' }}>{value}</span></div>;
}

function MiniToggle({ on, onChange, busy, disabled }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label="Dreaming global" disabled={busy || disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 38, height: 21, borderRadius: 999, border: '1px solid var(--border)',
        background: on ? 'var(--success)' : 'var(--border)', position: 'relative',
        cursor: busy || disabled ? 'default' : 'pointer', transition: 'var(--transition-fast)', padding: 0,
        opacity: disabled ? 0.65 : 1,
      }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 15, height: 15, borderRadius: 999, background: '#fff', transition: 'var(--transition-fast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <Loader2 size={10} className="animate-spin" color="#333" /> : null}
      </span>
    </button>
  );
}

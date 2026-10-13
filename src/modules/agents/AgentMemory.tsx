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

import { useCallback, useEffect, useState } from 'react';
import {
  Brain, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Moon, BookOpen, Sparkles, Wrench, Zap, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

// ── Shapes devueltas por los endpoints (todas enveloped: api.get NO desempaqueta) ──
interface MemoryEmbedding { ok?: boolean; checked?: boolean; error?: string; model?: string; dims?: number; }
interface DreamingEntry { key: string; path: string; snippet: string; recall_count: number; }
interface MemoryStatus {
  agent_id: string;
  provider?: string;
  embedding?: MemoryEmbedding;
  dreaming?: { enabled?: boolean; storage_mode?: string; short_term_entries?: DreamingEntry[] };
}
interface DreamDiary { content?: string; found?: boolean; path?: string; updated_at_ms?: number; }
interface RemHarness {
  ok?: boolean;
  deep_config?: Record<string, number>;
  rem?: { reflections?: unknown[]; candidate_truths?: unknown[]; source_entry_count?: number };
  deep?: { candidate_limit?: number; truncated?: boolean; candidates?: unknown[] };
}
interface DreamingConfig { memory_core_enabled?: boolean; enabled?: boolean; frequency?: string; }
interface ActiveMemoryConfig { plugin_enabled?: boolean; memory_core_enabled?: boolean; config?: { enabled?: boolean; agents?: string[] } }

type Env<T> = { data: T };

const card: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: 16,
  display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)',
};
const cardTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', margin: 0,
};
const dim: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-dim)' };

// Acciones de mantenimiento reversibles (snake_case = whitelist del backend) + descripción.
const MAINTENANCE: { action: string; label: string; desc: string; destructive?: boolean }[] = [
  { action: 'backfill_dream_diary', label: 'Rellenar diario', desc: 'Reconstruye el Dream Diary desde el corpus de sesiones. No toca MEMORY.md.' },
  { action: 'repair_dreaming_artifacts', label: 'Reparar artefactos', desc: 'Arregla ficheros de estado del dreaming corruptos o incompletos.' },
  { action: 'dedupe_dream_diary', label: 'Deduplicar diario', desc: 'Elimina entradas repetidas del Dream Diary.' },
  { action: 'reset_dream_diary', label: 'Reset diario', desc: 'Borra el diario narrativo (se regenera en el próximo sweep nocturno).', destructive: true },
  { action: 'reset_grounded_short_term', label: 'Reset grounded', desc: 'Vacía la cola de memoria a corto plazo "grounded".', destructive: true },
];

interface Props { agentId: string; agentName: string; agentBareName: string; }

export function AgentMemory({ agentId, agentName, agentBareName }: Props) {
  const role = useAuthStore(s => s.user?.role);
  const canManageGlobalMemory = role === 'owner' || role === 'admin';
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [diary, setDiary] = useState<DreamDiary | null>(null);
  const [rem, setRem] = useState<RemHarness | null>(null);
  const [dreamCfg, setDreamCfg] = useState<DreamingConfig | null>(null);
  const [amCfg, setAmCfg] = useState<ActiveMemoryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [togglingDream, setTogglingDream] = useState(false);
  const [togglingAm, setTogglingAm] = useState(false);
  const [showDiary, setShowDiary] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const base = `/managed-agents/${agentId}/memory`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, dd, rh, dc, am] = await Promise.all([
        api.get<Env<MemoryStatus>>(`${base}/status`),
        api.get<Env<DreamDiary>>(`${base}/dream-diary`).catch(() => null),
        api.get<Env<RemHarness>>(`${base}/rem-harness`).catch(() => null),
        api.get<Env<DreamingConfig>>('/managed-agents/memory-settings/dreaming').catch(() => null),
        api.get<Env<ActiveMemoryConfig>>('/managed-agents/memory-settings/active-memory').catch(() => null),
      ]);
      setStatus(st.data);
      setDiary(dd?.data ?? null);
      setRem(rh?.data ?? null);
      setDreamCfg(dc?.data ?? null);
      setAmCfg(am?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la memoria');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  const deepProbe = async () => {
    setProbing(true);
    try {
      const st = await api.get<Env<MemoryStatus>>(`${base}/status`, { deep: true });
      setStatus(st.data);
      toast.success('Embeddings probados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al probar embeddings');
    } finally {
      setProbing(false);
    }
  };

  const toggleDreaming = async (next: boolean) => {
    if (!canManageGlobalMemory) return;
    setTogglingDream(true);
    try {
      await api.patch('/gateway/dreaming-config', { enabled: next });
      setDreamCfg(c => ({ ...(c ?? {}), enabled: next }));
      toast.success(`Dreaming ${next ? 'activado' : 'desactivado'} (global)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al cambiar Dreaming');
    } finally {
      setTogglingDream(false);
    }
  };

  const amOn = !!amCfg?.config?.enabled && !!amCfg?.plugin_enabled && (amCfg?.config?.agents ?? []).includes(agentBareName);
  const toggleActiveMemory = async (next: boolean) => {
    if (!canManageGlobalMemory) return;
    setTogglingAm(true);
    try {
      if (next && !amCfg?.plugin_enabled) {
        await api.post('/gateway/plugins/active-memory/enable', {});
      }
      const current = amCfg?.config?.agents ?? [];
      const agents = next
        ? Array.from(new Set([...current, agentBareName]))
        : current.filter(a => a !== agentBareName);
      await api.patch('/gateway/active-memory-config', { config: { enabled: true, agents } });
      toast.success(`Recall proactivo ${next ? 'activado' : 'desactivado'} para ${agentName}`);
      const am = await api.get<Env<ActiveMemoryConfig>>('/managed-agents/memory-settings/active-memory').catch(() => null);
      setAmCfg(am?.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al cambiar Active Memory');
    } finally {
      setTogglingAm(false);
    }
  };

  const runMaintenance = async (action: string, label: string, destructive?: boolean) => {
    if (destructive && !window.confirm(`¿"${label}" para ${agentName}? Es reversible y NO edita MEMORY.md.`)) return;
    setBusy(action);
    setLastResult(null);
    try {
      await api.post(`${base}/maintenance`, { action });
      toast.success(`${label}: hecho`);
      setLastResult(`✓ ${label} ejecutado (${new Date().toLocaleTimeString()})`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Fallo en ${label}`;
      toast.error(msg);
      setLastResult(`✕ ${label}: ${msg}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, ...dim }}><Loader2 size={16} className="animate-spin" /> Cargando memoria…</div>;
  }
  if (error) {
    return (
      <div style={{ ...card, borderColor: 'var(--error)' }}>
        <div style={{ ...cardTitle, color: 'var(--error)' }}><AlertTriangle size={16} /> Error</div>
        <div style={dim}>{error}</div>
        <button onClick={() => void load()} style={btn()}><RefreshCw size={13} /> Reintentar</button>
      </div>
    );
  }

  const emb = status?.embedding ?? {};
  const dr = status?.dreaming ?? {};
  const shortTerm = dr.short_term_entries ?? [];
  const candidates = rem?.deep?.candidates ?? [];
  const minScore = rem?.deep_config?.min_score;
  const dreamingEnabled = dreamCfg?.enabled ?? dr.enabled ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Índice y embeddings */}
      <div style={card}>
        <div style={cardTitle}><Brain size={16} color="var(--amber)" /> Índice y embeddings</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <Field label="Provider" value={status?.provider || '—'} />
          {emb.model && <Field label="Modelo" value={emb.model} />}
          {typeof emb.dims === 'number' && <Field label="Dims" value={String(emb.dims)} />}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {!emb.checked ? (
              <>
                <span style={dim}>Embeddings sin probar</span>
                <button onClick={deepProbe} disabled={probing} style={btn()}>
                  {probing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Deep probe
                </button>
              </>
            ) : emb.ok ? (
              <span style={statusPill('var(--success)')}><CheckCircle2 size={13} /> Embeddings listos</span>
            ) : (
              <span style={statusPill('var(--error)')} title={emb.error}><AlertTriangle size={13} /> No disponibles</span>
            )}
          </div>
        </div>
        {emb.checked && !emb.ok && emb.error && <div style={{ ...dim, color: 'var(--error)' }}>{emb.error}</div>}
      </div>

      {/* Dreaming — toggle GLOBAL */}
      <div style={card}>
        <div style={cardTitle}>
          <Moon size={16} color="var(--amber)" /> Dreaming · consolidación nocturna
          <span style={{ ...statusPill('var(--text-dim)'), gap: 3, marginLeft: 6 }}><Globe size={11} /> global</span>
          <div style={{ marginLeft: 'auto' }}>
            <Toggle on={dreamingEnabled} busy={togglingDream} disabled={!canManageGlobalMemory} onChange={toggleDreaming} />
          </div>
        </div>
        <div style={dim}>
          Consolida de noche ({dreamCfg?.frequency ?? '0 3 * * *'}) las señales fuertes a <code>MEMORY.md</code>.
          <b> Es un ajuste global de OpenClaw memory-core</b> — afecta a todos tus agentes, no solo a {agentName}.
          {!canManageGlobalMemory && <> · <b>Solo lectura:</b> solo owner/admin puede modificarlo.</>}
          {' · '}señales en cola: <b>{shortTerm.length}</b> · modo: <b>{dr.storage_mode ?? '—'}</b>
          {dreamCfg && !dreamCfg.memory_core_enabled && <span style={{ color: 'var(--warning)' }}> · ⚠ el plugin memory-core está desactivado.</span>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={() => setShowDiary(s => !s)} style={btn()}>
            <BookOpen size={13} /> {showDiary ? 'Ocultar' : 'Ver'} Dream Diary
          </button>
          {/* Vista unificada per-agente: Resumen, Recuerdos, Sueños y ajustes. */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('claw:agents-tab', { detail: 'memory' }))}
            style={btn('var(--amber)')}
          >
            <Moon size={13} /> Abrir Memory →
          </button>
        </div>
        {showDiary && (
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 12, fontSize: '0.72rem', whiteSpace: 'pre-wrap', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
            {diary?.found && diary.content ? diary.content : 'Sin entradas en el diario todavía.'}
          </div>
        )}
      </div>

      {/* Active Memory — toggle per-agente */}
      <div style={card}>
        <div style={cardTitle}>
          <Zap size={16} color="var(--amber)" /> Recall proactivo (Active Memory)
          <div style={{ marginLeft: 'auto' }}>
            <Toggle on={amOn} busy={togglingAm} disabled={!canManageGlobalMemory} onChange={toggleActiveMemory} />
          </div>
        </div>
        <div style={dim}>
          Aflora memoria relevante ANTES de cada respuesta de <b>{agentName}</b> (sub-agente de recall). Per-agente.
          {!canManageGlobalMemory && <> <b>Solo lectura:</b> solo owner/admin puede modificar este ajuste compartido.</>}
          {amCfg && !amCfg.plugin_enabled && <span> Activarlo cargará el plugin.</span>}
        </div>
      </div>

      {/* Preview de próxima consolidación */}
      <div style={card}>
        <div style={cardTitle}><Sparkles size={16} color="var(--amber)" /> Próxima consolidación (preview)</div>
        {rem?.ok ? (
          <div style={dim}>
            Candidatos a promover a <code>MEMORY.md</code>: <b>{candidates.length}</b>
            {typeof minScore === 'number' && <> · umbral min_score <b>{minScore}</b></>}
            {rem.rem?.reflections && <> · reflexiones REM: <b>{rem.rem.reflections.length}</b></>}
            <div style={{ marginTop: 4 }}>Read-only: previsualiza qué promovería el sweep nocturno, sin escribir.</div>
          </div>
        ) : <div style={dim}>Sin datos del REM harness para este agente.</div>}
      </div>

      {/* Mantenimiento — con descripciones + feedback */}
      <div style={card}>
        <div style={cardTitle}><Wrench size={16} color="var(--amber)" /> Mantenimiento</div>
        <div style={dim}>Acciones de operador, reversibles. No editan <code>MEMORY.md</code>.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MAINTENANCE.map(m => (
            <div key={m.action} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text)', fontWeight: 500 }}>{m.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{m.desc}</div>
              </div>
              <button onClick={() => void runMaintenance(m.action, m.label, m.destructive)} disabled={busy !== null} style={{ ...btn(m.destructive ? 'var(--error)' : undefined), flexShrink: 0 }}>
                {busy === m.action ? <Loader2 size={13} className="animate-spin" /> : null} Ejecutar
              </button>
            </div>
          ))}
        </div>
        {lastResult && <div style={{ ...dim, marginTop: 4, color: lastResult.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>{lastResult}</div>}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, busy, disabled }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={on} disabled={disabled || busy}
      onClick={() => onChange(!on)}
      style={{
        width: 42, height: 23, borderRadius: 999, border: '1px solid var(--border)',
        background: on ? 'var(--success)' : 'var(--border)', position: 'relative',
        cursor: disabled || busy ? 'default' : 'pointer', transition: 'var(--transition-fast)', padding: 0,
      }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 21 : 2, width: 17, height: 17, borderRadius: 999, background: '#fff', transition: 'var(--transition-fast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <Loader2 size={11} className="animate-spin" color="#333" /> : null}
      </span>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function statusPill(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 600, color, padding: '2px 8px', borderRadius: 999, border: `1px solid ${color}` };
}

function btn(color?: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontFamily: 'var(--font-sans)', color: color ?? 'var(--text)', background: 'transparent', border: `1px solid ${color ?? 'var(--border)'}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', transition: 'var(--transition-fast)' };
}

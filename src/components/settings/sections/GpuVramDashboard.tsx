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

// ─── GPU & VRAM dashboard (Settings) ────────────────────────────────
// Dashboard visual del árbitro de VRAM: barra segmentada de VRAM en uso
// (protagonista) + tarjetas de modelos con rol/prioridad/pin + controles
// ⏸ Pausar / ⟲ Liberar VRAM + política. Datos en vivo (poll 4s + WS).

import { useState, useEffect, useRef, useCallback } from 'react';
import { Pause, Play, Eraser, Pin, RefreshCw, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import * as gw from '@/services/gateway.service';
import type { GpuCoordConfig, GpuCoordState } from '@/services/gateway.service';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useNavigate } from 'react-router';

const ROLE: Record<string, { color: string; label: string }> = {
  chat: { color: '#f59e0b', label: 'Chat' },
  embed: { color: '#06b6d4', label: 'Embedding' },
  extract: { color: '#8b5cf6', label: 'Extracción' },
  multimodal: { color: '#ec4899', label: 'Multimodal' },
  vision: { color: '#14b8a6', label: 'Visión' },
  other: { color: '#6b7280', label: 'Otros' },
};
// Cada rol → la sección del dash donde se configura ese modelo (pills navegables).
const ROLE_NAV: Record<string, string> = {
  chat: '/gateway?tab=models',
  embed: '/gateway?tab=models&view=advanced',
  multimodal: '/settings/ai',
  vision: '/settings/photos',
};
const STATUS: Record<string, { color: string; label: string }> = {
  loaded: { color: 'var(--success)', label: 'en VRAM' },
  idle: { color: 'var(--text-muted)', label: 'libre' },
};
const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' };

// ── Controles reutilizables ─────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', cursor: disabled ? 'default' : 'pointer', background: checked ? 'var(--amber)' : 'var(--border)', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.5 : 1, padding: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }} />
    </button>
  );
}

function Segmented<T extends string>({ options, value, onChange, disabled }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2, gap: 2 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)}
            style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: 4, border: 'none', cursor: disabled ? 'default' : 'pointer', background: on ? 'var(--amber)' : 'transparent', color: on ? '#000' : 'var(--text-dim)', fontWeight: on ? 600 : 400, transition: 'all .15s' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────
export function GpuVramDashboard() {
  const [config, setConfig] = useState<GpuCoordConfig | null>(null);
  const [state, setState] = useState<GpuCoordState | null>(null);
  const [saving, setSaving] = useState(false);
  const [freeing, setFreeing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEvent = useWebSocketStore((st) => st.lastEvent);
  const navigate = useNavigate();

  const refreshState = useCallback(() => { gw.getGpuState().then(setState).catch(() => {}); }, []);
  const refreshAll = useCallback(async () => {
    try { const r = await gw.getGpuCoordination(); setConfig(r.config); setState(r.state); } catch { /* gateway offline */ }
  }, []);

  useEffect(() => {
    refreshAll();
    timer.current = setInterval(refreshState, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refreshAll, refreshState]);

  useEffect(() => {
    if (!lastEvent || (lastEvent as { event?: string }).event !== 'gpu.coordinator') return;
    refreshState();
  }, [lastEvent, refreshState]);

  const save = async (patch: Partial<GpuCoordConfig>) => {
    setSaving(true);
    try { setConfig(await gw.updateGpuCoordination(patch)); }
    catch (e) { toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : 'error'}`); }
    finally { setSaving(false); }
  };

  const freeVram = async () => {
    setFreeing(true);
    try {
      const { unloaded, state } = await gw.freeGpuVram();
      setState(state);
      toast.success(unloaded.length ? `⟲ VRAM liberada · ${unloaded.length} modelo(s) descargado(s)` : 'No había modelos que descargar');
    } catch (e) { toast.error(`No se pudo liberar: ${e instanceof Error ? e.message : 'error'}`); }
    finally { setFreeing(false); }
  };

  if (!config || !state) return <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: 12 }}>Cargando estado de la GPU…</div>;
  if (state.vram_total_mb == null) return <div style={card}>No se detecta GPU NVIDIA — la coordinación de VRAM no aplica en esta máquina.</div>;

  const totalGb = state.vram_total_mb / 1024;
  const usedGb = (state.used_mb ?? Math.max(0, state.vram_total_mb - (state.free_vram_mb ?? 0))) / 1024;
  const freeGb = (state.free_vram_mb ?? 0) / 1024;
  const otherGb = state.other_gb ?? 0;
  const pct = Math.min(100, Math.round((usedGb / totalGb) * 100));

  const segs = [
    ...state.loaded.map((m) => ({ key: m.name, color: ROLE[m.role]?.color ?? '#6b7280', label: ROLE[m.role]?.label ?? m.role, gb: m.vram_gb, name: m.name.replace(/:latest$/, '') })),
    ...(otherGb > 0.05 ? [{ key: '__other', color: '#6b7280', label: 'Otros', gb: otherGb, name: 'visión / sistema' }] : []),
  ];

  const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: '0.75rem', fontWeight: 500, borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── HERO: barra de VRAM ── */}
      <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Cpu size={15} style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em' }}>VRAM del sistema</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NVIDIA · {totalGb.toFixed(1)} GB</span>
          <span style={{ flex: 1 }} />
          {/* estado */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, color: state.paused ? 'var(--amber)' : state.chat_active ? 'var(--amber)' : 'var(--success)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
            {state.paused ? 'Pausada' : state.chat_active ? 'Chat activo' : 'Activa'}
          </span>
          {/* refrescar */}
          <button type="button" onClick={refreshAll} title="Refrescar" style={{ ...actionBtn, padding: 5 }}><RefreshCw size={12} /></button>
          {/* pausar/reanudar */}
          <button type="button" onClick={() => save({ paused: !config.paused })} disabled={saving}
            style={{ ...actionBtn, ...(config.paused ? { background: 'color-mix(in srgb, var(--amber) 18%, transparent)', borderColor: 'var(--amber)', color: 'var(--amber)' } : {}) }}>
            {config.paused ? <><Play size={12} /> Reanudar</> : <><Pause size={12} /> Pausar GPU</>}
          </button>
          {/* liberar */}
          <button type="button" onClick={() => void freeVram()} disabled={freeing} style={actionBtn} title="Descargar TODOS los modelos de la VRAM">
            <Eraser size={12} /> {freeing ? 'Liberando…' : 'Liberar VRAM'}
          </button>
        </div>

        {/* números grandes */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{usedGb.toFixed(1)}</span>
          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {totalGb.toFixed(1)} GB</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>· {pct}%</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--success)' }}>{freeGb.toFixed(1)} GB libres</span>
        </div>

        {/* LA BARRA */}
        <div style={{ display: 'flex', height: 36, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 4px rgba(0,0,0,.45)', opacity: state.paused ? 0.45 : 1, transition: 'opacity .3s' }}>
          {segs.map((s) => (
            <div key={s.key} title={`${s.name} · ${s.gb.toFixed(1)} GB`}
              style={{ flexGrow: Math.max(s.gb, 0.001), flexBasis: 0, minWidth: s.gb > 0.05 ? 3 : 0, background: `linear-gradient(180deg, ${s.color}, color-mix(in srgb, ${s.color} 78%, #000))`, borderRight: '1px solid rgba(0,0,0,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'flex-grow .4s ease' }}>
              {(s.gb / totalGb) > 0.13 && <span style={{ fontSize: '0.66rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.55)', whiteSpace: 'nowrap', padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label} · {s.gb.toFixed(1)}G</span>}
            </div>
          ))}
          {freeGb > 0.02 && <div style={{ flexGrow: freeGb, flexBasis: 0, background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(255,255,255,.025) 5px, rgba(255,255,255,.025) 10px)' }} />}
        </div>

        {/* leyenda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 11 }}>
          {segs.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              {s.name} <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.gb.toFixed(1)} GB</span>
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: '1px solid var(--border)' }} /> libre <span style={{ fontVariantNumeric: 'tabular-nums' }}>{freeGb.toFixed(1)} GB</span>
          </span>
        </div>

        {state.paused ? (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', color: 'var(--amber)', fontSize: '0.75rem' }}>
            <Pause size={13} /> GPU pausada para uso externo — no se carga ningún modelo (ni el chat). Pulsa «Reanudar».
          </div>
        ) : state.queue.total > 0 ? (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)', fontSize: '0.74rem' }}>
            <Pause size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--amber)' }}>En cola (aplazadas por chat):</strong>
            {state.queue.embed > 0 && <span style={{ color: 'var(--text)' }}>🔢 embedding ×{state.queue.embed}</span>}
            {state.queue.extract > 0 && <span style={{ color: 'var(--text)' }}>🧩 extracción ×{state.queue.extract}</span>}
            <span style={{ color: 'var(--text-muted)' }}>→ corren al liberarse la GPU</span>
          </div>
        ) : state.chat_active ? (
          <div style={{ marginTop: 11, fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} /> Chateando — sin tareas de fondo pendientes en cola.
          </div>
        ) : null}
      </div>

      {/* ── MODELOS (catálogo completo: configurados, cargados o no) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Modelos</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{state.models.length} listos · {state.models.filter((m) => m.loaded).length} en VRAM</span>
        </div>
        {state.models.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No hay modelos instalados en Ollama.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {state.models.map((m) => {
              const r = ROLE[m.role] ?? { color: '#6b7280', label: m.role };
              const stat = STATUS[m.status] ?? { color: 'var(--text-muted)', label: m.status };
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: m.loaded ? 'color-mix(in srgb, var(--success) 7%, var(--surface))' : 'var(--surface)', border: `1px solid ${m.loaded ? 'color-mix(in srgb, var(--success) 28%, var(--border))' : 'var(--border)'}`, borderRadius: 'var(--radius-md)' }}>
                  {/* pill de rol → navega a su configuración */}
                  <button type="button" onClick={() => { const to = ROLE_NAV[m.role]; if (to) navigate(to); }} disabled={!ROLE_NAV[m.role]}
                    title={ROLE_NAV[m.role] ? `Configurar modelo de ${r.label} →` : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `color-mix(in srgb, ${r.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${r.color} 35%, transparent)`, fontSize: '0.68rem', color: 'var(--text)', flexShrink: 0, width: 108, boxSizing: 'border-box', cursor: ROLE_NAV[m.role] ? 'pointer' : 'default', transition: 'background .15s' }}
                    onMouseEnter={(e) => { if (ROLE_NAV[m.role]) e.currentTarget.style.background = `color-mix(in srgb, ${r.color} 28%, transparent)`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = `color-mix(in srgb, ${r.color} 15%, transparent)`; }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} /> {r.label}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }} title={m.name}>{m.name}{m.pinned ? ' 📌' : ''}</div>
                    {m.external ? (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>servicio externo (:7210) · pendiente</div>
                    ) : (
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginTop: 5 }}>
                        <div style={{ width: `${Math.min(100, (m.vram_gb / totalGb) * 100)}%`, height: '100%', background: r.color, opacity: m.loaded ? 1 : 0.4, transition: 'width .4s' }} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 56, textAlign: 'right' }}>{m.external ? '—' : `${m.vram_gb.toFixed(1)} GB`}</span>
                  <span style={{ fontSize: '0.68rem', color: m.external ? 'var(--text-muted)' : stat.color, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, width: 78 }}>
                    {!m.external && <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.status === 'idle' ? 'transparent' : stat.color, border: m.status === 'idle' ? `1px solid ${stat.color}` : 'none', flexShrink: 0 }} />} {m.external ? '—' : stat.label}
                  </span>
                  {m.external ? <span style={{ width: 25, flexShrink: 0 }} /> : (
                    <button type="button" onClick={() => save({ pinned_model: m.pinned ? null : m.name })} disabled={saving} title={m.pinned ? 'Quitar fijado' : 'Fijar (nunca descargar)'}
                      style={{ background: m.pinned ? 'color-mix(in srgb, var(--amber) 18%, transparent)' : 'transparent', border: `1px solid ${m.pinned ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: 5, cursor: 'pointer', color: m.pinned ? 'var(--amber)' : 'var(--text-muted)', flexShrink: 0, display: 'inline-flex' }}>
                      <Pin size={13} fill={m.pinned ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 10 }}>💡 Pulsa el rol de un modelo (Chat · Embedding · Multimodal · Visión) para ir a su configuración.</div>
        {state.onnx_loaded.length > 0 && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>👁 visión ONNX cargada: {state.onnx_loaded.join(', ')}</div>
        )}
      </div>

      {/* ── POLÍTICA ── */}
      <div style={card}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Política</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>Árbitro automático
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Coordina chat vs. tareas de fondo cuando no caben juntos</span>
            </span>
            <Toggle checked={config.enabled} onChange={(v) => save({ enabled: v })} disabled={saving} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>Prioridad global
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Quién manda cuando chat y multimodal/visión compiten por la GPU</span>
            </span>
            <Segmented value={config.priority} disabled={saving || !config.enabled}
              onChange={(v) => save({ priority: v })}
              options={[{ value: 'chat', label: 'Chat' }, { value: 'multimodal', label: 'Multimodal' }]} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>Ventana de inactividad
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Espera tras el último chat antes de correr lo aplazado</span>
            </span>
            <input type="range" min={1} max={30} value={config.idle_window_min} disabled={saving || !config.enabled}
              onChange={(e) => save({ idle_window_min: parseInt(e.target.value, 10) })}
              style={{ width: 150, accentColor: 'var(--amber)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', width: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{config.idle_window_min} min</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>Pausar fotos/visión mientras chateo</span>
            <Toggle checked={config.pause_photos_while_chat} onChange={(v) => save({ pause_photos_while_chat: v })} disabled={saving || !config.enabled} />
          </div>

          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            Solo 1 modelo de chat reside en GPU a la vez. La <strong>ventana de inactividad</strong> decide <em>cuándo</em> corren las tareas aplazadas; el <strong>keep_alive</strong> de cada modelo (en Gateway → Models) decide cuánto persiste en VRAM tras usarlo. Al vencer la ventana, si el modelo de chat no está fijado se descarga para hacer hueco.
          </p>
        </div>
      </div>
    </div>
  );
}

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

// Árbitro de VRAM (Fase 2) — panel de estado + preferencias. Muestra en vivo qué
// hay cargado en la GPU + VRAM libre + si el chat está activo, y deja configurar
// el comportamiento (prioridad, pin, pausar fotos, ventana). Polling ligero ~8s.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as gw from '@/services/gateway.service';
import type { GpuCoordConfig, GpuCoordState } from '@/services/gateway.service';

export function GpuCoordinationPanel() {
  const [config, setConfig] = useState<GpuCoordConfig | null>(null);
  const [state, setState] = useState<GpuCoordState | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { config, state } = await gw.getGpuCoordination();
      setConfig(config);
      setState(state);
    } catch { /* gateway offline */ }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(() => { gw.getGpuState().then(setState).catch(() => {}); }, 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  const save = async (patch: Partial<GpuCoordConfig>) => {
    setSaving(true);
    try {
      const next = await gw.updateGpuCoordination(patch);
      setConfig(next);
    } catch (e) {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!config || !state) return null;

  const freeGb = state.free_vram_mb != null ? (state.free_vram_mb / 1024).toFixed(1) : '?';
  const dot = !state.enabled ? '⚪' : state.chat_active ? '🟡' : '🟢';
  const summary = !state.enabled
    ? 'desactivado'
    : state.chat_active
      ? 'chat activo · fotos en espera'
      : state.photos_can_proceed ? 'libre' : 'ocupado';

  const label: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-dim)' };
  const sel: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '0.8125rem' };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16 }}>
      {/* Cabecera: estado live + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <Cpu size={15} style={{ color: 'var(--text-dim)' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Árbitro de VRAM</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{dot} {summary}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>VRAM libre: {freeGb} GB</span>
        <button onClick={(e) => { e.stopPropagation(); refresh(); }} title="Refrescar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><RefreshCw size={12} /></button>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{open ? '▾' : '▸'}</span>
      </div>

      {/* Modelos cargados ahora */}
      {state.loaded.length > 0 && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          En GPU: {state.loaded.map((m) => `${m.name.replace(/:latest$/, '')} (${m.vram_gb.toFixed(1)}GB)`).join(' · ')}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0 }}>
            Coordina la GPU (16GB) entre el modelo de texto del agente y el pipeline de fotos/visión. Principio "si caben, no toca nada". Cuando no caben, actúa automáticamente con la prioridad de abajo y lo registra en Activity Center.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={config.enabled} disabled={saving} onChange={(e) => save({ enabled: e.target.checked })} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Activar el árbitro automático</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, width: 130 }}>Prioridad</span>
            <select value={config.priority} disabled={saving || !config.enabled} onChange={(e) => save({ priority: e.target.value as GpuCoordConfig['priority'] })} style={sel}>
              <option value="chat">Chat primero (las fotos esperan)</option>
              <option value="photos">Fotos primero</option>
              <option value="balanced">Equilibrado</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, width: 130 }}>Ventana inactividad</span>
            <input type="number" min={1} max={60} value={config.idle_window_min} disabled={saving || !config.enabled}
              onChange={(e) => save({ idle_window_min: Math.max(1, parseInt(e.target.value, 10) || 3) })} style={{ ...sel, width: 70 }} />
            <span style={label}>min tras el último mensaje antes de reanudar fotos</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, width: 130 }}>Fijar modelo (pin)</span>
            <select value={config.pinned_model ?? ''} disabled={saving || !config.enabled} onChange={(e) => save({ pinned_model: e.target.value || null })} style={sel}>
              <option value="">Ninguno (se puede descargar)</option>
              {state.loaded.map((m) => {
                const base = m.name.replace(/:latest$/, '');
                return <option key={base} value={base}>{base}</option>;
              })}
              {config.pinned_model && !state.loaded.some((m) => m.name.replace(/:latest$/, '') === config.pinned_model) && (
                <option value={config.pinned_model}>{config.pinned_model}</option>
              )}
            </select>
          </div>
          <p style={{ ...label, margin: '-4px 0 0 140px', fontSize: '0.625rem' }}>Un modelo fijado NUNCA se descarga (a costa de que las fotos esperen/vayan a CPU).</p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={config.pause_photos_while_chat} disabled={saving || !config.enabled} onChange={(e) => save({ pause_photos_while_chat: e.target.checked })} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Pausar el análisis de fotos mientras chateo</span>
          </label>
        </div>
      )}
    </div>
  );
}

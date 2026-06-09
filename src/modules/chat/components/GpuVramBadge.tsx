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

// Indicador de VRAM en la cabecera del chat (Fase 2 · transparencia). Pill con
// mini-barra usado/total + tooltip con el detalle (modelos cargados, libre, si el
// chat tiene prioridad sobre las fotos). Polling ligero ~4s. Se oculta si no hay GPU.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { toast } from 'sonner';
import * as gw from '@/services/gateway.service';
import type { GpuCoordState } from '@/services/gateway.service';
import { useWebSocketStore } from '@/stores/websocket.store';

const ROLE_TAG: Record<string, string> = { chat: '💬', embed: '🔢', extract: '🧩', multimodal: '🖼', vision: '👁', other: '▒' };

export function GpuVramBadge() {
  const [s, setS] = useState<GpuCoordState | null>(null);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const refresh = useCallback(() => { gw.getGpuState().then(setS).catch(() => {}); }, []);
  const lastEvent = useWebSocketStore((st) => st.lastEvent);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  // Instantáneo: el coordinador broadcastea `gpu.coordinator` → refresca el badge
  // YA y muestra un toast en los swaps reales (no en cada turno de chat).
  useEffect(() => {
    if (!lastEvent || (lastEvent as { event?: string }).event !== 'gpu.coordinator') return;
    // El frame es {event:'gpu.coordinator', data:{...envelope..., payload:{action,model}}}.
    const env = (lastEvent as { data?: { payload?: { action?: string; model?: string }; action?: string; model?: string } }).data ?? {};
    const d = env.payload ?? env;
    refresh();
    if (d.action === 'unload') toast.info(`🧹 VRAM liberada para visión${d.model ? ` · ${d.model.replace(/:latest$/, '')} descargado` : ''}`);
    else if (d.action === 'photos.yield') toast.info('⏸ Análisis de fotos cediendo la GPU al chat');
    else if (d.action === 'free_all') toast.info('⟲ VRAM liberada — todos los modelos descargados');
  }, [lastEvent, refresh]);

  if (!s || s.vram_total_mb == null) return null; // sin GPU NVIDIA → sin badge

  const totalGb = s.vram_total_mb / 1024;
  const freeGb = (s.free_vram_mb ?? 0) / 1024;
  const usedGb = Math.max(0, totalGb - freeGb);
  const pct = Math.min(100, (usedGb / totalGb) * 100);
  const tight = pct > 88;
  const color = s.paused
    ? 'var(--amber)'
    : !s.enabled
      ? 'var(--text-muted)'
      : s.chat_active
        ? 'var(--amber)'
        : tight ? 'var(--amber)' : 'var(--green, #3fb950)';

  const statusLine = s.paused
    ? '⏸ GPU pausada (uso externo) — reanuda en Ajustes'
    : !s.enabled
      ? 'Árbitro de VRAM desactivado'
      : s.chat_active
        ? '💬 Chateando → análisis de fotos en espera'
        : s.photos_can_proceed
          ? '✓ GPU disponible para fotos/visión'
          : 'GPU ocupada';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 9px', borderRadius: 999,
        border: '1px solid var(--border)', background: 'var(--surface)',
        fontSize: '0.7rem', cursor: 'default', userSelect: 'none',
      }}>
        <Cpu size={12} style={{ color, transition: 'color .4s' }} />
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .5s ease, background .4s' }} />
        </div>
        <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{usedGb.toFixed(1)}/{totalGb.toFixed(0)}G</span>
      </div>

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500,
          width: 248, padding: '10px 12px',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.4))',
          fontSize: '0.72rem', color: 'var(--text)', cursor: 'default',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 600 }}>
            <span><Cpu size={11} style={{ verticalAlign: -1 }} /> GPU · VRAM</span>
            <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{usedGb.toFixed(1)} / {totalGb.toFixed(1)} GB</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .5s' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 3 }}>EN VRAM</div>
            {s.loaded.map((m) => (
              <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{ROLE_TAG[m.role] ?? '·'} {m.name.replace(/:latest$/, '')}{m.pinned ? ' 📌' : ''}</span>
                <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{m.vram_gb.toFixed(1)} GB</span>
              </div>
            ))}
            {(s.other_gb ?? 0) > 0.1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>▒ otros (visión/sistema)</span>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{(s.other_gb ?? 0).toFixed(1)} GB</span>
              </div>
            )}
            {s.loaded.length === 0 && (s.other_gb ?? 0) <= 0.1 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>GPU libre · {freeGb.toFixed(1)} GB</div>
            )}
          </div>

          {s.queue && s.queue.total > 0 && (
            <div style={{ marginBottom: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 3 }}>EN COLA (aplazadas por chat)</div>
              {s.queue.embed > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--amber)' }}>🔢 embedding ×{s.queue.embed} ⏸ → al quedar libre</div>}
              {s.queue.extract > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--amber)' }}>🧩 extracción ×{s.queue.extract} ⏸</div>}
            </div>
          )}

          <div style={{ color, fontWeight: 500, borderTop: '1px solid var(--border)', paddingTop: 6 }}>{statusLine}</div>
        </div>
      )}
    </div>
  );
}

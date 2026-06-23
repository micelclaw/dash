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

// ─── Historial SMART por disco ─────────────────────────────────────
// Modal (overlay inline, igual estilo que ZfsModals) que carga el histórico de
// muestras SMART de un disco vía store.fetchSmartHistory(diskId) y lo pinta en
// una tabla (fecha, estado, temperatura, sectores realocados/pendientes) más un
// mini-gráfico de la evolución de temperatura. En modo demo el store devuelve un
// histórico fabricado; en real llega del backend.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Activity } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import type { SmartHistoryEntry } from '../types';
import { InfoTip } from './ZfsHelp';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  width: 'min(640px, 100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
};
const head: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)',
};
const bodyStyle: React.CSSProperties = { padding: 16, display: 'flex', flexDirection: 'column', gap: 14 };

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
};
const STATUS_LABELS: Record<string, string> = {
  healthy: 'En buen estado',
  warning: 'Aviso',
  critical: 'Crítico',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Mini-gráfico de temperatura ────────────────────────────────────
// SVG polyline con la temperatura por muestra, en orden cronológico
// ascendente (la más antigua a la izquierda). Tolera huecos (null).
function TempChart({ entries }: { entries: SmartHistoryEntry[] }) {
  const W = 560, H = 90, PAD = 8;
  // Orden cronológico ascendente para leer izquierda→derecha.
  const ordered = [...entries].sort((a, b) => new Date(a.sampled_at).getTime() - new Date(b.sampled_at).getTime());
  const temps = ordered.map((e) => e.temperature_c);
  const known = temps.filter((t): t is number => t != null);
  if (known.length < 2) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>
        No hay suficientes muestras de temperatura para dibujar la evolución.
      </div>
    );
  }
  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min || 1;
  const n = ordered.length;
  const x = (i: number) => PAD + (n === 1 ? 0 : (i * (W - PAD * 2)) / (n - 1));
  const y = (t: number) => PAD + (H - PAD * 2) * (1 - (t - min) / span);

  const pts = ordered
    .map((e, i) => (e.temperature_c != null ? `${x(i).toFixed(1)},${y(e.temperature_c).toFixed(1)}` : null))
    .filter((p): p is string => p != null)
    .join(' ');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Temperatura
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          min {min}°C · max {max}°C
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--card, var(--bg))', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <polyline points={pts} fill="none" stroke="var(--mod-storage, var(--accent))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ordered.map((e, i) => e.temperature_c != null ? (
          <circle key={i} cx={x(i)} cy={y(e.temperature_c)} r={2.5} fill="var(--mod-storage, var(--accent))" />
        ) : null)}
      </svg>
    </div>
  );
}

export function SmartHistoryModal({ diskId, diskLabel, onClose }: { diskId: string; diskLabel?: string; onClose: () => void }) {
  const fetchSmartHistory = useStorageStore((s) => s.fetchSmartHistory);
  const [entries, setEntries] = useState<SmartHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setError(false);
    fetchSmartHistory(diskId)
      .then((res) => { if (alive) setEntries(res); })
      .catch((e) => {
        if (!alive) return;
        setError(true);
        toast.error(`No se pudo cargar el historial SMART: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => { alive = false; };
  }, [diskId, fetchSmartHistory]);

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 500,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <Activity size={16} style={{ color: 'var(--mod-storage)' }} />
          <strong style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text)' }}>
            Historial SMART{diskLabel ? ` — ${diskLabel}` : ''}
          </strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
        </div>
        <div style={bodyStyle}>
          {entries == null && !error && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Cargando historial…
            </div>
          )}
          {error && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No se pudo cargar el historial SMART de este disco.
            </div>
          )}
          {entries != null && !error && entries.length === 0 && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Sin muestras SMART registradas para este disco todavía.
            </div>
          )}
          {entries != null && !error && entries.length > 0 && (
            <>
              <TempChart entries={entries} />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
                  <thead>
                    <tr>
                      <th style={th}>Fecha</th>
                      <th style={th}>Estado</th>
                      <th style={{ ...th, textAlign: 'right' }}>Temp</th>
                      <th style={{ ...th, textAlign: 'right' }}>Horas</th>
                      <th style={{ ...th, textAlign: 'right' }}>
                        Realocados <InfoTip text="Sectores que el disco marcó como dañados y reemplazó por sectores de reserva. Un número que crece con el tiempo indica un disco que se está degradando." />
                      </th>
                      <th style={{ ...th, textAlign: 'right' }}>
                        Pendientes <InfoTip text="Sectores inestables a la espera de reasignación. Si no bajan a cero solos, conviene vigilar de cerca el disco." />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => {
                      const color = STATUS_COLORS[e.overall_status] ?? '#6b7280';
                      const badReal = e.reallocated_sectors > 0;
                      const badPend = e.pending_sectors > 0;
                      return (
                        <tr key={`${e.sampled_at}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>{fmtDate(e.sampled_at)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                              <span style={{ color: 'var(--text)' }}>{STATUS_LABELS[e.overall_status] ?? e.overall_status}</span>
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                            {e.temperature_c != null ? `${e.temperature_c}°C` : '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                            {e.power_on_hours != null ? e.power_on_hours.toLocaleString('es-ES') : '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: badReal ? '#f43f5e' : 'var(--text-dim)', fontWeight: badReal ? 600 : 400 }}>
                            {e.reallocated_sectors}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: badPend ? '#f43f5e' : 'var(--text-dim)', fontWeight: badPend ? 600 : 400 }}>
                            {e.pending_sectors}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

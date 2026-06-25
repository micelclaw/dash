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

// Selector de periodo COMPARTIDO por las gráficas de las lentes Personal y
// Facturación (unifica la apariencia). Pills "Este mes / 30 días / 90 días /
// 12 meses / Este año / Personalizado" + rango a medida con dos calendarios.

import { todayISO } from './personal/lib';

export type PeriodId = 'mes' | '30d' | '90d' | '12m' | 'anio' | 'custom';

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: '12m', label: '12 meses' },
  { id: 'anio', label: 'Este año' },
  { id: 'custom', label: 'Personalizado' },
];

// Formatea un Date local a 'YYYY-MM-DD' sin que el offset de zona lo corra de día.
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Etiqueta corta de un rango ISO (p.ej. "1 jun – 24 jun" o "1 ene 2025 – 24 jun").
export function fmtRangeLabel(from: string, to: string): string {
  const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T00:00:00');
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 'Personalizado';
  const sameYear = f.getFullYear() === t.getFullYear();
  const fmt = (d: Date, withY: boolean) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', ...(withY ? { year: 'numeric' } : {}) }).format(d);
  return `${fmt(f, !sameYear)} – ${fmt(t, true)}`;
}

// Calcula {from,to} (ISO) para el periodo. Función pura sobre new Date().
export function rangeFor(period: PeriodId): { from: string; to: string } {
  const to = todayISO();
  const now = new Date();
  switch (period) {
    case 'mes':
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: toISODate(d), to };
    }
    case '90d': {
      const d = new Date(now); d.setDate(d.getDate() - 90);
      return { from: toISODate(d), to };
    }
    case '12m': {
      const d = new Date(now); d.setDate(d.getDate() - 365);
      return { from: toISODate(d), to };
    }
    case 'anio':
      return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to };
    case 'custom':
      return { from: to, to }; // placeholder: el rango real lo provee el componente (customFrom/customTo)
  }
}

// Título del periodo: etiqueta del rango personalizado o el label del pill.
export function periodTitle(period: PeriodId, customFrom: string, customTo: string): string {
  return period === 'custom' ? fmtRangeLabel(customFrom, customTo) : (PERIODS.find((p) => p.id === period)?.label ?? '');
}

// Estilo de los <input type="date"> del rango personalizado.
export const dateInputStyle: React.CSSProperties = {
  padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 12, colorScheme: 'dark',
};

// Control segmentado (pills) que conduce el periodo de las gráficas.
export function PeriodSelector({ value, onChange }: { value: PeriodId; onChange: (p: PeriodId) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)' }}>
      {PERIODS.map((p) => (
        <button key={p.id} onClick={() => onChange(p.id)} style={{
          padding: '5px 10px', borderRadius: 'var(--radius-sm, 4px)', border: 'none', cursor: 'pointer', fontSize: 12,
          background: value === p.id ? 'var(--mod-finance)' : 'transparent',
          color: value === p.id ? '#0a0a0a' : 'var(--text-dim)', fontWeight: value === p.id ? 600 : 500,
          whiteSpace: 'nowrap',
        }}>{p.label}</button>
      ))}
    </div>
  );
}

// Fila de dos calendarios (desde / hasta) que aparece cuando el periodo es 'custom'.
export function CustomRangeInputs({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Desde</label>
      <input type="date" value={from} max={to} onChange={(e) => onFrom(e.target.value)} style={dateInputStyle} />
      <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Hasta</label>
      <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => onTo(e.target.value)} style={dateInputStyle} />
    </div>
  );
}

// Hook auxiliar: estado del periodo + rango efectivo + título. Centraliza el
// patrón que comparten ResumenTab (Personal) y FacturacionResumenTab.
import { useState } from 'react';

export function usePeriodRange(initial: PeriodId = '90d') {
  const [period, setPeriod] = useState<PeriodId>(initial);
  const [customFrom, setCustomFrom] = useState(() => { const n = new Date(); return toISODate(new Date(n.getFullYear(), n.getMonth(), 1)); });
  const [customTo, setCustomTo] = useState(() => todayISO());
  const range = period === 'custom' ? { from: customFrom, to: customTo } : rangeFor(period);
  const title = periodTitle(period, customFrom, customTo);
  return { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, range, title };
}

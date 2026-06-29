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

// Selector de periodo COMPARTIDO por las lentes Personal y Facturación. Conduce
// TODAS las tarjetas/listas/gráficas del resumen (no solo las gráficas). Tres
// modos mutuamente excluyentes:
//   · preset       — Este mes / 30 días / 90 días / 12 meses / Este año / Personalizado
//   · trimestres   — 1T..4T del año elegido, varios contiguos (1T+2T) seleccionables
//   · cuatrimestres— 1Q..3Q del año elegido, varios contiguos (2Q+3Q) seleccionables
// Nunca se mezclan dos modos. El estado vive en un Provider (FinancePeriodProvider)
// por encima de ambas lentes → el periodo se comparte y sobrevive al cambio de lente.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayISO } from './personal/lib';

// ─── Modelo ────────────────────────────────────────────────────────────────

export type PresetId = 'mes' | '30d' | '90d' | '12m' | 'anio' | 'custom';

/** Selección de periodo: un único modo activo a la vez. */
export type PeriodSelection =
  | { mode: 'preset'; preset: PresetId }
  | { mode: 'trimestres'; year: number; from: number; to: number } // from<=to en 1..4
  | { mode: 'cuatrimestres'; year: number; from: number; to: number }; // from<=to en 1..3

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: '12m', label: '12 meses' },
  { id: 'anio', label: 'Este año' },
  { id: 'custom', label: 'Personalizado' },
];

export const TRIMESTRES = [1, 2, 3, 4];   // 4 trimestres (3 meses cada uno)
export const CUATRIMESTRES = [1, 2, 3];   // 3 cuatrimestres (4 meses cada uno)

// ─── Helpers de fecha ────────────────────────────────────────────────────────

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

// Rango {from,to} (ISO) de un preset relativo a hoy.
export function rangeForPreset(preset: PresetId, customFrom: string, customTo: string): { from: string; to: string } {
  const to = todayISO();
  const now = new Date();
  switch (preset) {
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
      return { from: customFrom, to: customTo };
  }
}

// Rango {from,to} de un bloque de unidades CONTIGUAS (trimestres o cuatrimestres)
// del año `year`. monthsPer = 3 (trimestre) o 4 (cuatrimestre).
function unitRange(year: number, fromUnit: number, toUnit: number, monthsPer: number): { from: string; to: string } {
  const startMonth = (fromUnit - 1) * monthsPer;       // 0-based, 1er mes del bloque
  const endMonthExclusive = toUnit * monthsPer;        // 1er mes DESPUÉS del bloque
  return {
    from: toISODate(new Date(year, startMonth, 1)),
    to: toISODate(new Date(year, endMonthExclusive, 0)), // día 0 del mes siguiente = último del anterior
  };
}

/** Rango efectivo {from,to} (ISO) de una selección. */
export function rangeForSelection(sel: PeriodSelection, customFrom: string, customTo: string): { from: string; to: string } {
  if (sel.mode === 'preset') return rangeForPreset(sel.preset, customFrom, customTo);
  if (sel.mode === 'trimestres') return unitRange(sel.year, sel.from, sel.to, 3);
  return unitRange(sel.year, sel.from, sel.to, 4);
}

/** Etiqueta legible de la selección (para títulos de tarjetas/gráficas). */
export function titleForSelection(sel: PeriodSelection, customFrom: string, customTo: string): string {
  if (sel.mode === 'preset') {
    return sel.preset === 'custom' ? fmtRangeLabel(customFrom, customTo) : (PRESETS.find((p) => p.id === sel.preset)?.label ?? '');
  }
  const suffix = sel.mode === 'trimestres' ? 'T' : 'Q';
  const head = sel.from === sel.to ? `${sel.from}${suffix}` : `${sel.from}${suffix}–${sel.to}${suffix}`;
  return `${head} ${sel.year}`;
}

// Reducer de click sobre una unidad (trimestre/cuatrimestre). Mantiene SIEMPRE un
// bloque contiguo [from,to]; extiende por adyacencia, encoge por los extremos, y
// resetea a una sola unidad si el click cae fuera/al medio o cambia de año/modo.
function clickUnit(
  sel: PeriodSelection,
  mode: 'trimestres' | 'cuatrimestres',
  unit: number,
  year: number,
): PeriodSelection {
  if (sel.mode !== mode || sel.year !== year) return { mode, year, from: unit, to: unit };
  const { from, to } = sel;
  if (unit === to + 1) return { mode, year, from, to: unit };   // extiende por la derecha
  if (unit === from - 1) return { mode, year, from: unit, to }; // extiende por la izquierda
  if (unit >= from && unit <= to) {
    if (from === to) return { mode, year, from: unit, to: unit }; // único → no cambia
    if (unit === from) return { mode, year, from: from + 1, to }; // encoge por la izquierda
    if (unit === to) return { mode, year, from, to: to - 1 };     // encoge por la derecha
    return { mode, year, from: unit, to: unit };                  // medio → resetea
  }
  return { mode, year, from: unit, to: unit };                    // fuera (no adyacente) → resetea
}

// ─── Estilos / inputs de rango personalizado ─────────────────────────────────

export const dateInputStyle: React.CSSProperties = {
  padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 12, colorScheme: 'dark',
};

// Fila de dos calendarios (desde / hasta) para el preset 'custom'.
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

// ─── Selector (control segmentado) ───────────────────────────────────────────

// Pill de un control segmentado tintado en --mod-finance cuando está activo.
function Pill({ label, active, onClick, title }: { label: string; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 10px', borderRadius: 'var(--radius-sm, 4px)', border: 'none', cursor: 'pointer', fontSize: 12,
        background: active ? 'var(--mod-finance)' : 'transparent',
        color: active ? '#0a0a0a' : 'var(--text-dim)', fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// Grupo de pills (zona del control segmentado, fondo propio).
function Segment({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)' }}>
      {children}
    </div>
  );
}

/**
 * Control de periodo completo (presets + trimestres + cuatrimestres + año + rango
 * personalizado). Autocontenido; lee/escribe el periodo del Provider. Pensado para
 * el header superior de cada lente; usa flex-wrap para bajar de línea si no cabe.
 */
export function PeriodControl() {
  const { selection, selectPreset, toggleTrimestre, toggleCuatrimestre, tqYear, setYear, customFrom, customTo, setCustomFrom, setCustomTo } = useFinancePeriod();
  const isTQ = selection.mode === 'trimestres' || selection.mode === 'cuatrimestres';
  const tActive = (q: number) => selection.mode === 'trimestres' && q >= selection.from && q <= selection.to;
  const qActive = (t: number) => selection.mode === 'cuatrimestres' && t >= selection.from && t <= selection.to;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* Presets relativos a hoy */}
        <Segment>
          {PRESETS.map((p) => (
            <Pill key={p.id} label={p.label} active={selection.mode === 'preset' && selection.preset === p.id} onClick={() => selectPreset(p.id)} />
          ))}
        </Segment>

        {/* Trimestres (3 meses) */}
        <Segment>
          {TRIMESTRES.map((q) => (
            <Pill key={q} label={`${q}T`} title={`Trimestre ${q}`} active={tActive(q)} onClick={() => toggleTrimestre(q)} />
          ))}
        </Segment>

        {/* Cuatrimestres (4 meses) */}
        <Segment>
          {CUATRIMESTRES.map((t) => (
            <Pill key={t} label={`${t}Q`} title={`Cuatrimestre ${t}`} active={qActive(t)} onClick={() => toggleCuatrimestre(t)} />
          ))}
        </Segment>

        {/* Selector de año: solo para trimestres/cuatrimestres */}
        {isTQ && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)' }}>
            <button onClick={() => setYear(tqYear - 1)} aria-label="Año anterior" style={{ display: 'flex', alignItems: 'center', padding: 4, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 'var(--radius-sm, 4px)' }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{tqYear}</span>
            <button onClick={() => setYear(tqYear + 1)} aria-label="Año siguiente" style={{ display: 'flex', alignItems: 'center', padding: 4, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 'var(--radius-sm, 4px)' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Rango personalizado: 2ª fila con dos calendarios */}
      {selection.mode === 'preset' && selection.preset === 'custom' && (
        <CustomRangeInputs from={customFrom} to={customTo} onFrom={setCustomFrom} onTo={setCustomTo} />
      )}
    </div>
  );
}

// ─── Provider / hook ─────────────────────────────────────────────────────────

interface FinancePeriodValue {
  selection: PeriodSelection;
  setSelection: (s: PeriodSelection) => void;
  selectPreset: (p: PresetId) => void;
  toggleTrimestre: (q: number) => void;
  toggleCuatrimestre: (t: number) => void;
  /** Año vigente para trimestres/cuatrimestres (el de la selección o el año en curso). */
  tqYear: number;
  setYear: (year: number) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  /** Rango efectivo {from,to} en ISO 'YYYY-MM-DD' que conduce TODO el resumen. */
  range: { from: string; to: string };
  /** Etiqueta legible del periodo (títulos de tarjetas/gráficas). */
  title: string;
}

const FinancePeriodContext = createContext<FinancePeriodValue | null>(null);

export function FinancePeriodProvider({ children, initial = { mode: 'preset', preset: '12m' } }: { children: ReactNode; initial?: PeriodSelection }) {
  const [selection, setSelection] = useState<PeriodSelection>(initial);
  const [customFrom, setCustomFrom] = useState(() => { const n = new Date(); return toISODate(new Date(n.getFullYear(), n.getMonth(), 1)); });
  const [customTo, setCustomTo] = useState(() => todayISO());

  // Año vigente para T/Q: el de la selección si está en ese modo; si no, el año en curso.
  const tqYear = selection.mode === 'trimestres' || selection.mode === 'cuatrimestres' ? selection.year : new Date().getFullYear();

  const selectPreset = (preset: PresetId) => setSelection({ mode: 'preset', preset });
  const toggleTrimestre = (q: number) => setSelection((s) => clickUnit(s, 'trimestres', q, tqYear));
  const toggleCuatrimestre = (t: number) => setSelection((s) => clickUnit(s, 'cuatrimestres', t, tqYear));
  const setYear = (year: number) => setSelection((s) => (s.mode === 'trimestres' || s.mode === 'cuatrimestres') ? { ...s, year } : s);

  const range = useMemo(() => rangeForSelection(selection, customFrom, customTo), [selection, customFrom, customTo]);
  const title = useMemo(() => titleForSelection(selection, customFrom, customTo), [selection, customFrom, customTo]);

  const value: FinancePeriodValue = {
    selection, setSelection, selectPreset, toggleTrimestre, toggleCuatrimestre,
    tqYear, setYear, customFrom, setCustomFrom, customTo, setCustomTo, range, title,
  };
  return <FinancePeriodContext.Provider value={value}>{children}</FinancePeriodContext.Provider>;
}

export function useFinancePeriod(): FinancePeriodValue {
  const ctx = useContext(FinancePeriodContext);
  if (!ctx) throw new Error('useFinancePeriod debe usarse dentro de <FinancePeriodProvider>');
  return ctx;
}

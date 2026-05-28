/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — Home-Assistant style time range picker.
 *
 * Renders a button showing the currently selected range. Clicking opens
 * a popover with:
 *   - Preset list (Hoy, Ayer, Última hora, Últimas 24h, Últimos 7 días…)
 *   - Custom range with native datetime-local inputs.
 *
 * The picker is fully controlled — it neither owns the range nor reads
 * the time itself outside of preset evaluation. Selecting any option
 * fires `onChange` with `{from, to}` (ISO timestamps) or `null` to
 * clear the range and fall back to each endpoint's default tail.
 *
 * IMPORTANT: this range affects both the chart and the table — they
 * share the same `rows` array, which is fetched by `useActivityRows`
 * with the same `range` prop the header receives.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import type { TimeRange } from './adapters/types';

type PresetKey =
  | 'last_hour'
  | 'last_12h'
  | 'last_24h'
  | 'last_7d'
  | 'last_30d'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month';

interface Preset {
  key: PresetKey;
  label: string;
  /** Compute (from, to) ISO timestamps relative to `now`. */
  compute: (now: Date) => TimeRange;
}

const PRESETS: Preset[] = [
  {
    key: 'last_hour',
    label: 'Última hora',
    compute: (now) => ({
      from: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }),
  },
  {
    key: 'last_12h',
    label: 'Últimas 12 horas',
    compute: (now) => ({
      from: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }),
  },
  {
    key: 'last_24h',
    label: 'Últimas 24 horas',
    compute: (now) => ({
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }),
  },
  {
    key: 'last_7d',
    label: 'Últimos 7 días',
    compute: (now) => ({
      from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }),
  },
  {
    key: 'last_30d',
    label: 'Últimos 30 días',
    compute: (now) => ({
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    }),
  },
  {
    key: 'today',
    label: 'Hoy',
    compute: (now) => {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to: now.toISOString() };
    },
  },
  {
    key: 'yesterday',
    label: 'Ayer',
    compute: (now) => {
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
      return { from: startYesterday.toISOString(), to: startToday.toISOString() };
    },
  },
  {
    key: 'this_week',
    label: 'Esta semana',
    compute: (now) => {
      // Lunes como inicio de semana (locale es).
      const day = now.getDay(); // 0=dom, 1=lun…
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      return { from: monday.toISOString(), to: now.toISOString() };
    },
  },
  {
    key: 'this_month',
    label: 'Este mes',
    compute: (now) => {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    },
  },
];

/**
 * Try to identify the preset whose computed range matches `range`
 * within ~10s of tolerance (a button press never lands exactly at the
 * second). When nothing matches, returns 'custom' so the popover knows
 * to highlight the custom inputs.
 */
function detectPreset(range: TimeRange | undefined): PresetKey | 'custom' | null {
  if (!range) return null;
  const now = new Date();
  for (const preset of PRESETS) {
    const computed = preset.compute(now);
    const fromDelta = Math.abs(new Date(computed.from).getTime() - new Date(range.from).getTime());
    const toDelta = Math.abs(new Date(computed.to).getTime() - new Date(range.to).getTime());
    // Generous tolerance: presets recompute against `now` which keeps
    // moving — anything within a minute is "the same preset".
    if (fromDelta < 60_000 && toDelta < 60_000) return preset.key;
  }
  return 'custom';
}

function isoToLocalInputValue(iso: string): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in LOCAL time. Date.toISOString
  // gives us UTC, so we adjust by the timezone offset.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function localInputValueToIso(value: string): string {
  // datetime-local emits a "naïve" timestamp meant to be local. `new
  // Date(value)` parses it as local, then toISOString gives UTC.
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatRangeLabel(range: TimeRange | undefined): string {
  if (!range) return 'Todo el histórico';
  const detected = detectPreset(range);
  if (detected && detected !== 'custom') {
    return PRESETS.find((p) => p.key === detected)?.label ?? 'Rango personalizado';
  }
  // Custom — render the actual window compactly.
  const from = new Date(range.from);
  const to = new Date(range.to);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) {
    return `${from.toLocaleDateString()} ${from.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${to.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${from.toLocaleDateString()} — ${to.toLocaleDateString()}`;
}

interface Props {
  range?: TimeRange;
  onChange: (range: TimeRange | undefined) => void;
}

export function TimeRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom range draft — kept independent of the active range so the
  // user can edit both fields before applying.
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  // When opening the popover with a range already active, seed the
  // draft from it so the custom inputs show the current selection.
  useEffect(() => {
    if (!open) return;
    if (range) {
      setDraftFrom(isoToLocalInputValue(range.from));
      setDraftTo(isoToLocalInputValue(range.to));
    } else {
      // Default custom window: last 24h.
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setDraftFrom(isoToLocalInputValue(yesterday.toISOString()));
      setDraftTo(isoToLocalInputValue(now.toISOString()));
    }
  }, [open, range]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const node = containerRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activePresetKey = useMemo(() => detectPreset(range), [range]);
  const label = useMemo(() => formatRangeLabel(range), [range]);

  function pickPreset(preset: Preset) {
    onChange(preset.compute(new Date()));
    setOpen(false);
  }

  function applyCustom() {
    const fromIso = localInputValueToIso(draftFrom);
    const toIso = localInputValueToIso(draftTo);
    if (!fromIso || !toIso) return;
    if (new Date(fromIso).getTime() >= new Date(toIso).getTime()) return;
    onChange({ from: fromIso, to: toIso });
    setOpen(false);
  }

  function clear() {
    onChange(undefined);
    setOpen(false);
  }

  const hasRange = !!range;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
        aria-label="Rango temporal"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={12} />
        <span className={hasRange ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>
          {label}
        </span>
        {hasRange && (
          <X
            size={12}
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            aria-label="Limpiar rango"
          />
        )}
        {!hasRange && <ChevronDown size={12} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selector de rango temporal"
          className="absolute right-0 top-full mt-1 z-30 w-[440px] rounded-md border border-[var(--border)] bg-[var(--bg)] shadow-lg"
        >
          <div className="grid grid-cols-2">
            {/* Presets — left column */}
            <div className="border-r border-[var(--border)] py-1">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Presets
              </div>
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => pickPreset(preset)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] ${
                    activePresetKey === preset.key ? 'bg-[var(--surface-hover)] text-[var(--primary)]' : ''
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom range — right column */}
            <div className="py-1 px-3 flex flex-col gap-2">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] pt-0.5">
                Personalizado
              </div>
              <label className="text-[11px] flex flex-col gap-1 text-[var(--text-muted)]">
                Desde
                <input
                  type="datetime-local"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </label>
              <label className="text-[11px] flex flex-col gap-1 text-[var(--text-muted)]">
                Hasta
                <input
                  type="datetime-local"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </label>
              <div className="flex items-center justify-between gap-2 mt-1">
                <button
                  onClick={clear}
                  className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                >
                  Limpiar
                </button>
                <button
                  onClick={applyCustom}
                  className="text-xs px-3 py-1 rounded bg-[var(--primary)] text-white hover:opacity-90"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

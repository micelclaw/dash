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

// ─── Context budget bar (Agent Overview) ───────────────────────────
//
// A single composite bar scaled to the model's context window, with segments in
// order: [ base≈ | system-prompt | apps | libre ]. The `base≈` segment (OpenClaw
// base prompt + native tools) is a distinct striped pattern to flag it's an
// estimate. All numbers are estimates (backend uses prose /4, tool-schema /1.3);
// no chart library — the bar is built with div widths (ProgressBar pattern).

import { useMemo } from 'react';
import type { ContextBudget } from '@/services/agent-context.service';

interface ContextBudgetBarsProps {
  budget: ContextBudget | null;
  loading?: boolean;
}

const C_SYS = 'var(--amber)';   // system prompt (identity files)
const C_APPS = '#34d399';        // apps (facade tools)

/** Compact "≈Xk" style number. Mirrors BuildHeaderStrip.formatNum. */
function fmtTok(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return String(n);
  return `${(n / 1000).toFixed(a < 10_000 ? 1 : 0)}k`;
}

/** Overall usage color: green <50% · amber <80% · red ≥80% (BuildHeaderStrip pattern). */
function usageColor(ratio: number): string {
  if (ratio < 0.5) return '#22c55e';
  if (ratio < 0.8) return 'var(--amber)';
  return 'var(--error)';
}

const BASE_SEGMENT_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--text-muted) 18%, transparent)',
  backgroundImage: 'repeating-linear-gradient(45deg, color-mix(in srgb, var(--text-muted) 55%, transparent) 0 3px, transparent 3px 7px)',
};

function Segment({ pct, color, base, label }: { pct: number; color?: string; base?: boolean; label: string }) {
  if (pct <= 0) return null;
  return (
    <div
      title={label}
      style={{
        width: `${pct}%`,
        minWidth: 2,
        height: '100%',
        flexShrink: 0,
        ...(base ? BASE_SEGMENT_STYLE : { background: color }),
      }}
    />
  );
}

function Swatch({ color, base }: { color?: string; base?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block', width: 9, height: 9, borderRadius: 2, flexShrink: 0,
        ...(base ? BASE_SEGMENT_STYLE : { background: color }),
      }}
    />
  );
}

function LegendItem({ swatch, text, color }: { swatch: React.ReactNode; text: string; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: color ?? 'var(--text-dim)', fontSize: '0.6875rem' }}>
      {swatch}
      {text}
    </span>
  );
}

export function ContextBudgetBars({ budget, loading }: ContextBudgetBarsProps) {
  const derived = useMemo(() => {
    if (!budget) return null;
    const sys = budget.system_prompt.blocks.reduce((s, b) => s + b.tokens, 0);
    const apps = budget.apps.reduce((s, a) => s + a.tokens, 0);
    const base = budget.system_prompt.base_tokens + budget.native_tokens;
    const used = budget.used_tokens;
    const window = budget.model_window;
    const free = budget.free_tokens;
    const overBudget = window !== null && used > window;
    // Scale segments to the window (normal) or to `used` (over budget / unknown
    // window → show the composition filling the bar).
    const scale = window !== null && !overBudget ? window : used;
    const pct = (n: number) => (scale > 0 ? (n / scale) * 100 : 0);
    const winPct = (n: number) => (window && window > 0 ? Math.round((n / window) * 100) : 0);
    return { sys, apps, base, used, window, free, overBudget, pct, winPct };
  }, [budget]);

  if (loading && !budget) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>Presupuesto de contexto</span>
        <div style={{ height: 14, borderRadius: 7, background: 'var(--border)', opacity: 0.5 }} />
      </div>
    );
  }
  if (!budget || !derived) return null;

  const { sys, apps, base, used, window, free, overBudget, pct, winPct } = derived;
  const ratio = window && window > 0 ? used / window : 0;
  const summaryColor = window === null ? 'var(--text-dim)' : usageColor(ratio);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header: label + summary */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>
          Presupuesto de contexto
        </span>
        {window === null ? (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            ≈{fmtTok(used)} tokens · ventana desconocida
          </span>
        ) : (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            ≈{fmtTok(used)} / {fmtTok(window)}{' '}
            <span style={{ color: summaryColor, fontWeight: 600 }}>({winPct(used)}%)</span>
          </span>
        )}
      </div>

      {/* Composite bar */}
      <div
        style={{
          display: 'flex', width: '100%', height: 14, borderRadius: 7, overflow: 'hidden',
          background: 'var(--border)', boxSizing: 'border-box',
        }}
      >
        <Segment pct={pct(base)} base label={`base ≈${fmtTok(base)}`} />
        <Segment pct={pct(sys)} color={C_SYS} label={`System prompt ≈${fmtTok(sys)}`} />
        <Segment pct={pct(apps)} color={C_APPS} label={`Apps ≈${fmtTok(apps)}`} />
        {/* Remaining track = libre (only visible when the window isn't exceeded). */}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <LegendItem swatch={<Swatch base />} text={`base ≈${fmtTok(base)}`} />
        <LegendItem
          swatch={<Swatch color={C_SYS} />}
          text={`System prompt ≈${fmtTok(sys)}${window !== null ? ` (${winPct(sys)}%)` : ''}`}
        />
        <LegendItem
          swatch={<Swatch color={C_APPS} />}
          text={`Apps ≈${fmtTok(apps)}${window !== null ? ` (${winPct(apps)}%)` : ''}`}
        />
        {window !== null && !overBudget && (
          <LegendItem
            swatch={<Swatch color="var(--border)" />}
            text={`Libre ≈${fmtTok(free ?? 0)} (${winPct(free ?? 0)}%)`}
          />
        )}
        {overBudget && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--error)', fontSize: '0.6875rem', fontWeight: 600 }}>
            −{fmtTok(used - (window ?? 0))} sobre presupuesto
          </span>
        )}
      </div>
    </div>
  );
}

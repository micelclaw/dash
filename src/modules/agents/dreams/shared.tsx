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

import type { DreamPhase } from './types';

// ── Normalizadores ──────────────────────────────────────────────────────────

/** promoted_at / last_recalled_at pueden llegar como epoch-ms o ISO → ISO|null. */
export function toIso(v: string | number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? new Date(v).toISOString() : null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function isRecent(v: string | number | undefined | null, hours = 24): boolean {
  const iso = toIso(v);
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < hours * 3_600_000;
}

/** «en 2 h 14 m» / «en 3 d» / null si pasado o ausente. */
export function formatCountdown(nextRunAtMs: number | undefined | null): string | null {
  if (!nextRunAtMs || !Number.isFinite(nextRunAtMs)) return null;
  const diff = nextRunAtMs - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'en <1 m';
  if (mins < 60) return `en ${mins} m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `en ${hours} h ${mins % 60} m`;
  return `en ${Math.floor(hours / 24)} d`;
}

/** Hora legible de un cron simple `m h * * *` / `m h * * d` → «03:00» (o el cron crudo). */
export function cronToTime(cron: string | undefined | null): string | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h] = parts;
  if (m === undefined || h === undefined) return cron;
  const dow = parts[4];
  if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
    const suffix = dow !== undefined && dow !== '*' ? weekdaySuffix(dow) : '';
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}${suffix}`;
  }
  if (/^\*\/\d+$/.test(h) || /^\d+(,\d+)*$/.test(h) === false) {
    const every = /^\*\/(\d+)$/.exec(h);
    if (every) return `cada ${every[1]} h`;
  }
  return cron;
}

function weekdaySuffix(dow: string): string {
  const names: Record<string, string> = { '0': 'dom', '1': 'lun', '2': 'mar', '3': 'mié', '4': 'jue', '5': 'vie', '6': 'sáb', '7': 'dom' };
  return names[dow] ? ` (${names[dow]})` : '';
}

// ── Piezas visuales ─────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = { light: 'LIGERO', deep: 'PROFUNDO', rem: 'REM' };

export function phaseTooltip(name: string, p: DreamPhase): string {
  const bits: string[] = [`cron: ${p.cron ?? '—'}`];
  if (p.lookback_days !== undefined) bits.push(`mira ${p.lookback_days} días atrás`);
  if (p.limit !== undefined) bits.push(`límite ${p.limit}`);
  if (p.min_score !== undefined) bits.push(`min_score ${p.min_score}`);
  if (p.min_recall_count !== undefined) bits.push(`min recalls ${p.min_recall_count}`);
  if (p.min_pattern_strength !== undefined) bits.push(`min patrón ${p.min_pattern_strength}`);
  return `${PHASE_LABEL[name] ?? name}: ${bits.join(' · ')}`;
}

export function PhaseChip({ name, phase }: { name: 'light' | 'deep' | 'rem'; phase: DreamPhase | undefined }) {
  if (!phase) return null;
  const on = phase.enabled !== false;
  const countdown = on ? formatCountdown(phase.next_run_at_ms) : null;
  const time = cronToTime(phase.cron);
  return (
    <span
      title={phaseTooltip(name, phase)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
        border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.68rem',
        color: 'var(--text-dim)', opacity: on ? 1 : 0.45, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--success)' : 'var(--text-muted)' }} />
      <b style={{ color: 'var(--text)', letterSpacing: '0.04em' }}>{PHASE_LABEL[name]}</b>
      {time && <span>{time}</span>}
      {countdown && <span style={{ color: 'var(--success)' }}>{countdown}</span>}
      {!on && <span>off</span>}
    </span>
  );
}

/** Mini-badge de señal («2 señales», «☀ 1», …). */
export function SignalBadge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999,
      border: '1px solid var(--border)', fontSize: '0.62rem', color: color ?? 'var(--text-dim)',
      background: 'var(--bg-subtle, rgba(127,127,127,0.06))', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export const dreamCard: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: 14,
  display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)',
};

export const sectionTitle: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export const dimText: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-dim)' };

export function dreamBtn(color?: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem',
    fontFamily: 'var(--font-sans)', color: color ?? 'var(--text)', background: 'transparent',
    border: `1px solid ${color ?? 'var(--border)'}`, borderRadius: 7, padding: '5px 10px',
    cursor: 'pointer', transition: 'var(--transition-fast)',
  };
}

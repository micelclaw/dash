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

// ─── Studio v2 — Build header strip ────────────────────────────────
//
// Single-row stat strip + action buttons. Lives just above the Build
// columns. Token / turn counters come from the project row (mirrored
// by the event-bridge). Stop is enabled while running. "Continuar a
// Testing" enables once the user has had at least one assistant turn.

import { Square, ArrowRight, Settings, CheckSquare, Play } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { StreamStatus } from '../../hooks/useOpencodeStream';
import { useStudioStore, type StudioChecklistItem, type StudioOpencodeMode } from '@/stores/studio.store';

interface Props {
  status: StreamStatus;
  tokensUsed: number;
  tokenCap: number;
  turnsUsed: number;
  turnCap: number;
  startedAt: number | null;
  onStop: () => void;
  /** Click to advance to Testing. The 2nd arg is `force` — true when
   *  the user shift+clicks the disabled button. */
  onFinish: (force: boolean) => void;
  onOpenSettings: () => void;
  /** Optional click handler for the checklist counter (e.g. expand the
   *  panel below). When omitted the counter is just a label. */
  onChecklistClick?: () => void;
  /** Live checklist used to gate "Continuar a Testing" + show progress. */
  checklist: StudioChecklistItem[];
  /** Has the agent produced at least one assistant turn (kept for
   *  backwards compat — used as a floor when the checklist is empty). */
  turnsHaveStarted: boolean;
  /** Current OC session mode. `null` when there's no active session. */
  mode?: StudioOpencodeMode | null;
  /** When true, the user has flipped the "force plan mode" toggle —
   *  every turn is gated by plan-approval. We tag the badge so it's
   *  clear plan-mode is sticky, not a transient first-turn state. */
  forcePlanMode?: boolean;
  /** Becomes `true` once /build/start has been called (or any session
   *  exists). Drives the visibility of the Start vs Stop slot and the
   *  "Continuar a Testing" button. */
  isStarted: boolean;
  /** True while POST /build/start is in flight. Disables Start so the
   *  user can't double-click. */
  starting: boolean;
  /** Click handler for the Start button (no-op if `isStarted`). */
  onStart: () => void;
  /** The project id is needed by the clickable mode chip so it can
   *  POST to /build/approve-plan or /build/revert-to-plan. */
  projectId: string;
}

const FINISH_THRESHOLD = 0.8;
const FINISH_ASK_THRESHOLD = 0.4;

export function BuildHeaderStrip({
  status, tokensUsed, tokenCap, turnsUsed, turnCap,
  startedAt, onStop, onFinish, onOpenSettings, onChecklistClick,
  checklist, turnsHaveStarted, mode, forcePlanMode,
  isStarted, starting, onStart, projectId,
}: Props) {
  const elapsed = startedAt ? formatDuration(Date.now() - startedAt) : '—';
  const dot =
    status === 'running' ? '#22c55e'
    : status === 'idle' ? 'var(--text-muted)'
    : status === 'aborted' ? 'var(--text-muted)'
    : status === 'failed' ? 'var(--danger)'
    : 'var(--text-muted)';
  const statusText =
    status === 'running' ? 'running'
    : status === 'idle' ? 'idle'
    : status === 'loading' ? 'loading'
    : status;
  const tokensColor = tokensUsed > tokenCap * 0.8 ? 'var(--danger)' : tokensUsed > tokenCap * 0.5 ? 'var(--amber)' : 'var(--text)';

  // ─── Checklist gating ────────────────────────────────────────────
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((it) => it.status === 'done').length;
  const checklistRatio = checklistTotal > 0 ? checklistDone / checklistTotal : 0;
  const checklistColor =
    checklistTotal === 0 ? 'var(--text-muted)'
    : checklistRatio >= FINISH_THRESHOLD ? '#22c55e'
    : checklistRatio >= FINISH_ASK_THRESHOLD ? 'var(--amber)'
    : 'var(--danger)';
  // Finish gating:
  //   - No active session OR plan-mode: never show (the user shouldn't
  //     be able to skip to Testing before the agent has actually built
  //     anything). Even an emergency escape hatch is wrong here — if
  //     they really want out, they can rewind from the project menu.
  //   - Build-mode + turnsHaveStarted + checklist >=80% → enabled.
  //   - Build-mode + 40-80% → enabled but ámbar (ask before forcing).
  //   - Anything else → hidden.
  const finishVisible =
    isStarted && mode === 'build' && checklistTotal > 0 && turnsHaveStarted;
  const finishMode: 'go' | 'ask' = checklistRatio >= FINISH_THRESHOLD
    ? 'go'
    : 'ask';
  const finishStyle = finishMode === 'go' ? btnPrimary : btnAsk;
  const finishTitle =
    finishMode === 'go' ? 'Continuar a Testing'
    : `Checklist al ${Math.round(checklistRatio * 100)}% — recomendado ≥80%. Click para forzar.`;
  const finishBlockedReason = !isStarted
    ? 'Inicia el build primero'
    : mode === 'plan'
      ? 'Aprueba el plan para que el Builder ejecute antes de pasar a Testing'
      : checklistTotal === 0
        ? 'Esperando a que el Builder emita la checklist'
        : !turnsHaveStarted
          ? 'El agente debe haber producido al menos un turn'
          : checklistRatio < FINISH_ASK_THRESHOLD
            ? `Completa al menos ${Math.round(FINISH_ASK_THRESHOLD * 100)}% de la checklist`
            : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '8px 16px', borderBottom: '1px solid var(--border)',
      flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
      background: mode === 'plan'
        ? 'color-mix(in srgb, var(--amber) 6%, var(--card))'
        : 'var(--card)',
      borderTop: mode === 'plan' ? '2px solid var(--amber)' : '2px solid transparent',
      transition: 'background 200ms ease, border-color 200ms ease',
    }}>
      {mode && <ModeBadge mode={mode} forcePlanMode={!!forcePlanMode} projectId={projectId} canToggle={isStarted} />}
      <Stat label="Turn" value={`${turnsUsed} / ${turnCap}`} />
      <Stat label="Time" value={elapsed} />
      <Stat label="Tokens" value={`${formatNum(tokensUsed)} / ${formatNum(tokenCap)}`} valueColor={tokensColor} />
      {checklistTotal > 0 && (
        <button
          type="button"
          onClick={onChecklistClick}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: onChecklistClick ? 'pointer' : 'default',
            padding: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            color: 'var(--text)',
          }}
          title={onChecklistClick ? 'Open checklist' : undefined}
        >
          <CheckSquare size={11} style={{ color: checklistColor }} />
          <span style={{ color: checklistColor }}>{checklistDone}/{checklistTotal}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            ({Math.round(checklistRatio * 100)}%)
          </span>
        </button>
      )}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--text-dim)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
        {statusText}
      </span>
      <span style={{ flex: 1 }} />
      {/* Lifecycle slot: Start (no session yet) | Stop (running) | hidden */}
      {!isStarted && (
        <button
          onClick={onStart}
          disabled={starting}
          style={starting ? { ...btnPrimary, opacity: 0.6, cursor: 'wait' } : btnPrimary}
          aria-label="Start build"
        >
          <Play size={11} fill="currentColor" /> {starting ? 'Starting…' : 'Start build'}
        </button>
      )}
      {isStarted && status === 'running' && (
        <button onClick={onStop} style={btnDanger} aria-label="Stop">
          <Square size={11} fill="currentColor" /> Stop
        </button>
      )}
      {finishVisible && (
        <button
          onClick={(e) => {
            if (finishMode === 'ask') {
              const ok = e.shiftKey || window.confirm(
                `La checklist está al ${Math.round(checklistRatio * 100)}%. ¿Forzar paso a Testing igualmente?`,
              );
              if (!ok) return;
              onFinish(true);
              return;
            }
            onFinish(false);
          }}
          style={finishStyle}
          title={finishTitle}
        >
          Continuar a Testing <ArrowRight size={11} />
        </button>
      )}
      {!finishVisible && finishBlockedReason && isStarted && (
        <span
          title={finishBlockedReason}
          style={{
            fontSize: '0.65rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)', cursor: 'help',
          }}
        >
          Testing locked
        </span>
      )}
      <button onClick={onOpenSettings} style={btnGhost} aria-label="Settings">
        <Settings size={13} />
      </button>
    </div>
  );
}

function ModeBadge({
  mode, forcePlanMode, projectId, canToggle,
}: {
  mode: StudioOpencodeMode;
  forcePlanMode: boolean;
  projectId: string;
  canToggle: boolean;
}) {
  const approveBuildPlan = useStudioStore((s) => s.approveBuildPlan);
  const revertBuildToPlan = useStudioStore((s) => s.revertBuildToPlan);
  const [busy, setBusy] = useState(false);

  const isPlan = mode === 'plan';
  const fg = isPlan ? 'var(--amber)' : '#22c55e';
  const label = isPlan
    ? (forcePlanMode ? 'PLAN MODE · forzado' : 'PLAN MODE')
    : 'BUILD MODE';
  const subtitle = isPlan ? 'click to approve' : 'click to revert to plan';
  const tooltip = !canToggle
    ? (isPlan
      ? 'PLAN MODE — start the build first to enable approval'
      : 'BUILD MODE')
    : (isPlan
      ? 'Click to APPROVE the plan and switch to BUILD MODE — the agent will start executing.'
      : 'Click to REVERT to PLAN MODE — useful to extend or revise the plan without aborting the session.');

  const handleClick = async (): Promise<void> => {
    if (!canToggle || busy) return;
    if (isPlan) {
      const ok = window.confirm(
        '¿Aprobar el plan y empezar el build? El agente pasará a ejecutar tool calls (escribir archivos, montar rutas, correr tests).',
      );
      if (!ok) return;
      setBusy(true);
      try {
        await approveBuildPlan(projectId);
        toast.success('Plan aprobado — el Builder empieza a ejecutar.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo aprobar: ${msg}`);
      } finally { setBusy(false); }
    } else {
      const ok = window.confirm(
        '¿Volver a PLAN MODE? El próximo mensaje irá al planner read-only — útil para extender o revisar el plan. La sesión sigue activa.',
      );
      if (!ok) return;
      setBusy(true);
      try {
        await revertBuildToPlan(projectId);
        toast.success('Sesión revertida a plan-mode. El siguiente mensaje no tocará archivos.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo revertir: ${msg}`);
      } finally { setBusy(false); }
    }
  };

  const interactive = canToggle && !busy;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!interactive}
      title={tooltip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 'var(--radius-full)',
        background: `color-mix(in srgb, ${fg} 22%, transparent)`,
        color: fg,
        border: `1.5px solid ${fg}`,
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
        fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase',
        cursor: interactive ? 'pointer' : 'not-allowed',
        boxShadow: isPlan && interactive ? `0 0 0 3px color-mix(in srgb, ${fg} 12%, transparent)` : undefined,
        flexShrink: 0,
        opacity: busy ? 0.6 : 1,
        transition: 'opacity 120ms ease, box-shadow 120ms ease',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: fg, boxShadow: `0 0 6px ${fg}`,
      }} />
      <span>{label}</span>
      {canToggle && (
        <span style={{ opacity: 0.75, fontWeight: 500 }}>· {subtitle}</span>
      )}
    </button>
  );
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
        {label}
      </span>
      <span style={{ color: valueColor ?? 'var(--text)' }}>{value}</span>
    </span>
  );
}

function formatNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${m % 60}m`;
  if (m > 0) return `${m}m${(s % 60).toString().padStart(2, '0')}s`;
  return `${s}s`;
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
const btnAsk: React.CSSProperties = {
  ...btnPrimary,
  background: 'var(--amber)',
  // Slightly translucent + outline so the user notices it's "soft go".
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
  opacity: 0.85,
};
const btnDanger: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: '0.75rem',
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: 4, background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};

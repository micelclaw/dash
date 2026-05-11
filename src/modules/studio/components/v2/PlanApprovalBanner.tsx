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

// ─── Studio v2 — Plan approval banner ──────────────────────────────
//
// Renders between the BuildHeaderStrip and the workspace/chat split
// while the OC session is in `mode='plan'`. Three visual states keyed
// off (streaming, hasChecklist):
//   - WRITING:  streaming + no checklist yet → "Builder is writing the plan…"
//   - UPDATING: streaming + checklist exists → "Builder is updating the plan…"
//   - READY:    not streaming + checklist    → "Plan ready — approve to start"
// The Approve button is enabled ONLY in READY. This avoids the race
// where the button briefly appeared clickable right after Start (status
// was still `idle` because the first WS event hadn't arrived yet, so
// `streamingInProgress` was false but no plan existed yet).

import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';

interface Props {
  projectId: string;
  /** True while the agent is producing tokens. */
  streamingInProgress: boolean;
  /** Number of items in the project's build checklist. >0 means the
   *  agent has already emitted a `BUILD_CHECKLIST` sentinel block. */
  checklistCount: number;
}

type BannerState = 'writing' | 'updating' | 'ready';

export function PlanApprovalBanner({ projectId, streamingInProgress, checklistCount }: Props) {
  const approveBuildPlan = useStudioStore((s) => s.approveBuildPlan);
  const [approving, setApproving] = useState(false);

  const state: BannerState = streamingInProgress
    ? (checklistCount > 0 ? 'updating' : 'writing')
    : (checklistCount > 0 ? 'ready' : 'writing');

  const title =
    state === 'writing'  ? 'El Builder está escribiendo el plan…'
    : state === 'updating' ? 'El Builder está actualizando el plan…'
    : 'El Builder ha propuesto un plan';

  const subtitle =
    state === 'writing'  ? 'Verás los pasos en el chat según los redacta. Podrás aprobar cuando termine.'
    : state === 'updating' ? 'Lee los cambios en el chat. Podrás aprobar cuando termine.'
    : 'Revisa la checklist arriba y el plan en el chat. Pide ajustes o aprueba para empezar la ejecución.';

  const buttonDisabled = approving || state !== 'ready';

  const handleApprove = async (): Promise<void> => {
    if (buttonDisabled) return;
    setApproving(true);
    try {
      await approveBuildPlan(projectId);
      toast.success('Plan aprobado — el Builder empieza a ejecutar.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo aprobar el plan: ${msg}`);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Plan approval banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'color-mix(in srgb, var(--amber) 10%, var(--card))',
        borderBottom: '1px solid var(--amber)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        flexShrink: 0,
      }}
    >
      {state === 'ready'
        ? <Sparkles size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        : <Loader2 size={16} className="spin" style={{ color: 'var(--amber)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <button
        type="button"
        onClick={() => { void handleApprove(); }}
        disabled={buttonDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          fontSize: '0.75rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          background: buttonDisabled ? 'var(--surface)' : 'var(--amber)',
          color: buttonDisabled ? 'var(--text-muted)' : 'var(--bg)',
          border: '1px solid var(--amber)',
          borderRadius: 'var(--radius-sm)',
          cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          opacity: buttonDisabled ? 0.7 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        {approving ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
        Aprobar plan y empezar Build
      </button>
    </div>
  );
}

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

import { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';

interface Props {
  projectId: string;
  /** True while the agent is producing tokens. */
  streamingInProgress: boolean;
  /** Number of items in the project's build checklist. >0 means the
   *  agent has already emitted a `BUILD_CHECKLIST` sentinel block. */
  checklistCount: number;
  /** Live build stream status. Used to render an error state instead of an
   *  eternal "writing…" spinner when the session died with no plan (M10). */
  status?: 'idle' | 'running' | 'aborted' | 'failed' | 'loading';
  /** Guided mode (D5): reframe the plan-approval as a plain-language
   *  "Propuesta: ¿lo hago?" instead of "approve the plan / Build". */
  guided?: boolean;
}

type BannerState = 'writing' | 'updating' | 'ready' | 'error';

// After this long in the "writing" state with no progress, reassure the user
// it's still working rather than leaving a silent spinner (R-B).
const STALL_HINT_MS = 45_000;

export function PlanApprovalBanner({ projectId, streamingInProgress, checklistCount, status, guided }: Props) {
  const approveBuildPlan = useStudioStore((s) => s.approveBuildPlan);
  const [approving, setApproving] = useState(false);
  const [stalled, setStalled] = useState(false);

  // M10: a dead session (failed/aborted) with no checklist must NOT keep
  // spinning "writing…" forever — surface an error the user can act on.
  const sessionDead = (status === 'failed' || status === 'aborted') && !streamingInProgress;

  const state: BannerState = sessionDead && checklistCount === 0
    ? 'error'
    : streamingInProgress
      ? (checklistCount > 0 ? 'updating' : 'writing')
      : (checklistCount > 0 ? 'ready' : 'writing');

  // Reassurance timer while we're in the (spinner) 'writing' state.
  useEffect(() => {
    if (state !== 'writing') { setStalled(false); return; }
    const t = setTimeout(() => setStalled(true), STALL_HINT_MS);
    return () => clearTimeout(t);
  }, [state]);

  const title = state === 'error'
    ? (guided ? 'I couldn\'t prepare the proposal' : 'The build session stopped')
    : guided
    ? (state === 'writing'  ? 'Thinking up a proposal…'
      : state === 'updating' ? 'Refining the proposal…'
      : 'I have a proposal for you')
    : (state === 'writing'  ? 'The Builder is writing the plan…'
      : state === 'updating' ? 'The Builder is updating the plan…'
      : 'The Builder proposed a plan');

  const subtitle = state === 'error'
    ? (guided ? 'Type below and I\'ll try again.' : 'Send a message in the chat to retry the plan.')
    : guided
    ? (state === 'writing'  ? (stalled ? 'Still on it — this can take a moment. You\'ll see it below as soon as it\'s ready.' : 'I\'ll tell you what I plan to do in a moment.')
      : state === 'updating' ? 'I\'m adjusting the steps with what you told me.'
      : 'I propose building your app with the steps on the left. Shall I start?')
    : (state === 'writing'  ? (stalled ? 'Still working — this can take a while. You\'ll see the steps in the chat as they arrive.' : 'You\'ll see the steps in the chat as they\'re written. You can approve when it finishes.')
      : state === 'updating' ? 'Read the changes in the chat. You can approve when it finishes.'
      : 'Review the checklist above and the plan in the chat. Ask for tweaks or approve to start.');

  const buttonDisabled = approving || state !== 'ready';

  const handleApprove = async (): Promise<void> => {
    if (buttonDisabled) return;
    setApproving(true);
    try {
      await approveBuildPlan(projectId);
      toast.success('Plan approved — the Builder is starting.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Couldn't approve the plan: ${msg}`);
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
        : state === 'error'
        ? <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
        : <Loader2 size={16} className="spin" style={{ color: 'var(--amber)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      {state !== 'error' && (
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
        {guided ? 'Yes, go ahead' : 'Approve plan & start Build'}
      </button>
      )}
    </div>
  );
}

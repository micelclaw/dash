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

// ─── RewindButton — destructive jump back to an earlier phase ──────
//
// Rendered inside any phase component when the project's `status` is
// AHEAD of the currently viewed phase (i.e. the user is browsing a
// past phase in read-only mode and wants to start editing it). The
// button opens a confirmation dialog listing what will be cleared,
// then calls the backend rewind endpoint and navigates the URL back
// to the no-`?phase=` form so the page re-renders in edit mode.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Rewind, Loader2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStudioStore,
  type StudioRewindTarget,
  type StudioTarget,
} from '@/stores/studio.store';

interface Props {
  projectId: string;
  /** Phase to rewind to. Must be ≤ project.status (caller's contract). */
  target: StudioRewindTarget;
  /** The PROJECT's target (ADR-17/18). Only `micelclaw_app` builds a `.claw`
   *  package; the static targets ship a site ZIP, so the dialog must not
   *  promise to delete an artifact that never existed. Omitted → app copy. */
  projectTarget?: StudioTarget | null;
  /** Optional override label for the trigger button (default: "Rewind here to edit"). */
  label?: string;
  /** Guided mode (D5): Spanish, reassuring copy framed as a safety net
   *  (R-C). Honest about what's discarded (the build) AND about what's
   *  kept (idea, design, data) — never claims "nothing is lost". */
  guided?: boolean;
}

// Human-language summary of what survives a guided rewind (R-C copy).
// Honest: the generated build is discarded; the idea/design/data are kept.
const GUIDED_KEPT = 'Your idea, your design and your data are kept.';
const GUIDED_LOST: Record<StudioRewindTarget, string> = {
  design: 'The plan and what was built so far are discarded, and you go back to choosing what this should be.',
  foundation: 'What I\'ve built so far is discarded — I can rebuild it whenever you want.',
};

// Mirror of the cleared-fields table in `core/src/studio/services/rewind.service.ts`.
// Used purely for the dialog copy.
//
// The LAST entry is the packaged artifact and it is target-dependent: the
// server clears the same `package_*` columns for everyone, but what those
// columns point at is a `.claw` bundle only for `micelclaw_app`. The static
// targets (website/webapp/mobile) are packaged by `packageStaticSite` as
// `<slug>-<version>-site.zip` — telling their owner we delete "the built
// .claw package" names a file they never had.
const PACKAGE_LINE: Record<StudioTarget, string> = {
  micelclaw_app: 'the built .claw package',
  website: 'the built site ZIP',
  webapp: 'the built site ZIP',
  mobile: 'the built site ZIP',
  design: 'the exported ZIP',
};

function packageLine(projectTarget?: StudioTarget | null): string {
  return PACKAGE_LINE[projectTarget ?? 'micelclaw_app'] ?? PACKAGE_LINE.micelclaw_app;
}

function clearedFor(target: StudioRewindTarget, projectTarget?: StudioTarget | null): string[] {
  const tail = [
    'the build session + agent chat history',
    'all generated code in the workspace',
    'the test results',
    packageLine(projectTarget),
  ];
  switch (target) {
    case 'design':
      return [
        'the type you chose (app / website / …) and its scope',
        'the plan document',
        ...tail,
      ];
    case 'foundation':
    default:
      return tail;
  }
}

export function RewindButton({ projectId, target, projectTarget, label, guided }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const rewindProject = useStudioStore((s) => s.rewindProject);

  async function confirm() {
    setBusy(true);
    try {
      await rewindProject(projectId, target);
      toast.success(guided ? 'Done — you went back.' : `Project rewound to "${target}"`);
      // Drop the ?phase= query param so the page re-renders in edit
      // mode against the new (lower) status. Use replace so the back
      // button doesn't take the user to the now-invalid past view.
      setSearchParams({}, { replace: true });
      // Light navigation kick to make sure ProjectDetailPage refetches
      // (the store update already triggered a re-render, but this also
      // resets any local component state).
      navigate(`/studio/${projectId}`, { replace: true });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rewind failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={guided ? triggerGuided : triggerStyle}
        title={guided ? 'Go back without breaking anything' : `Rewind to ${target}`}
      >
        <Rewind size={12} /> {label ?? (guided ? 'Go back' : 'Rewind here to edit')}
      </button>

      {open && (
        <div style={overlayStyle} onClick={() => !busy && setOpen(false)}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={dialogHeader}>
              <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
              <h3 style={{ fontSize: '0.9375rem', margin: 0, color: 'var(--text)', flex: 1 }}>
                {guided ? 'Go back?' : `Rewind to "${target}"`}
              </h3>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                style={iconBtn}
              >
                <X size={14} />
              </button>
            </div>

            {guided ? (
              <>
                <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.5 }}>
                  {GUIDED_LOST[target]}
                </p>
                <p style={{
                  margin: '0 0 16px', fontSize: '0.8125rem', lineHeight: 1.5,
                  color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span aria-hidden>🔒</span> {GUIDED_KEPT}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  This action is <strong>destructive and irreversible</strong>. Rewinding to this phase will clear:
                </p>

                <ul style={{
                  margin: '0 0 12px', paddingLeft: 18,
                  fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.6,
                }}>
                  {clearedFor(target, projectTarget).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <p style={{ margin: '0 0 16px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Only the scope, the documents generated up to this phase and the project's data are kept.
                  After rewinding you can regenerate the following phases or accept them as they were.
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={cancelBtn}
              >
                {guided ? 'Not now' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                style={confirmBtn(busy)}
              >
                {busy
                  ? <><Loader2 size={12} className="animate-spin" /> {guided ? 'Going back…' : 'Rewinding…'}</>
                  : <><Rewind size={12} /> {guided ? 'Yes, go back' : 'Yes, rewind'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--amber)',
  color: 'var(--amber)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
// Guided trigger: discreet, reassuring (a safety net, not an alarm).
const triggerGuided: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.72rem', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'color-mix(in srgb, #000 60%, transparent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const dialogStyle: React.CSSProperties = {
  maxWidth: 480, width: '100%',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
  fontFamily: 'var(--font-sans)',
};
const dialogHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  paddingBottom: 8, marginBottom: 12,
  borderBottom: '1px solid var(--border)',
};
const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: 4, background: 'transparent',
  border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const confirmBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});

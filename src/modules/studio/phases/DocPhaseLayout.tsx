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

// ─── Shared layout for the three Studio doc phases ──────────────────
//
// concept / frontend / foundation all have the same shape:
//   - generate / regenerate button + cancel
//   - streaming markdown viewer (live or persisted)
//   - question cards panel (fed by pending_questions)
//   - approve / comment CTA when the doc is settled
//
// This component encapsulates that loop so each phase only has to
// supply (a) the docKey, (b) the trigger callbacks, and (c) the copy.

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject } from '@/stores/studio.store';
import { useStudioStream } from '../hooks/useStudioStream';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { QuestionCardsPanel } from '../components/QuestionCardsPanel';
import { RewindButton } from '../components/RewindButton';
import { StreamDebugOverlay } from '../components/StreamDebugOverlay';

export interface DocPhaseLayoutProps {
  project: StudioProject;
  /** Phase identifier matching the WS event payload + cancel route. */
  phase: 'concept' | 'frontend' | 'foundation';
  /** The doc field on the project to read the persisted version from. */
  docKey: 'doc_concept' | 'doc_frontend' | 'doc_foundation';
  /** Display title (e.g. "Documento de concepto"). */
  title: string;
  /** Empty-state copy shown when no doc exists yet. */
  emptyHint: string;
  /** Approve button label (varies between phases). */
  approveLabel: string;
  /** Whether the approve action should also offer a comment textarea. */
  withApprovalComment?: boolean;
  /** Trigger generation. Receives optional answers from the question loop. */
  onGenerate: (answers?: Record<string, string>) => Promise<void>;
  /** Approve and advance phase. */
  onApprove: (comment?: string) => Promise<void>;
  /**
   * 'edit' (default) shows the full Generate/Approve/QuestionCards UI;
   * 'past' renders the persisted doc read-only with a single
   * RewindButton in the toolbar — used when the user is browsing a
   * past phase via `?phase=` while the project has already advanced.
   */
  viewMode?: 'edit' | 'past';
  /**
   * Phase-specific label for the FIRST-TURN context textarea, shown
   * inside the empty state above the "Generar" button. Examples:
   *   - "Cuéntame de qué va tu proyecto" (concept)
   *   - "¿Cómo te imaginas la UI?" (frontend)
   *   - "Restricciones técnicas o decisiones ya tomadas" (foundation)
   */
  initialContextLabel?: string;
  /** Placeholder for the same textarea. */
  initialContextPlaceholder?: string;
}

export function DocPhaseLayout(props: DocPhaseLayoutProps) {
  const {
    project, phase, docKey, title, emptyHint, approveLabel,
    withApprovalComment, onGenerate, onApprove,
    viewMode = 'edit',
    initialContextLabel,
    initialContextPlaceholder,
  } = props;
  const isPast = viewMode === 'past';
  // First-turn context textarea state. Only used when the empty state
  // is rendered (no doc yet). On submit, we pack it into
  // `_user_comment` so the backend `concept.service` extracts it and
  // passes it as `userContext` to the initial prompt.
  const [initialContext, setInitialContext] = useState('');

  const cancelGeneration = useStudioStore((s) => s.cancelGeneration);
  const refetchProject = useStudioStore((s) => s.refetchProject);

  const { state, reset, debug } = useStudioStream(project.id, phase);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  // Safety-net refetch for tab-navigation cases (user closed and
  // re-opened the tab while streaming). The PRIMARY refetch path is
  // inside `handleGenerate` after `await onGenerate(...)` returns —
  // that's the only one guaranteed to see the persisted data because
  // the WS `done` event fires BEFORE the calling service has written
  // the parsed doc + pending_questions to the DB. The race window is
  // small (5–20ms) but real, which is why we need both.
  useEffect(() => {
    if (state.status === 'done') {
      // Tiny delay to lose the race against the await-based refetch in
      // handleGenerate. Without this, the WS event triggers a refetch
      // BEFORE the service-level db.update has committed.
      const timer = setTimeout(() => {
        refetchProject(project.id).catch(() => {});
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state.status, project.id, refetchProject]);

  const isStreaming = state.status === 'starting' || state.status === 'streaming';
  const docFromProject = (project[docKey] ?? '') as string;
  // During streaming we render the parsed body (between DOC_BODY
  // sentinels) to avoid showing the raw `<!-- DOC_BODY_START -->`
  // markers and the inline JSON of pending questions to the user.
  // `state.displayBody` falls back gracefully when sentinels haven't
  // arrived yet.
  const displayText = isStreaming || state.status === 'done'
    ? (state.displayBody || state.text)
    : docFromProject;
  const hasDoc = displayText.length > 0;
  // Questions: prefer the LIVE-streamed ones (parsed incrementally
  // from the WS token stream as soon as the JSON block closes), fall
  // back to the persisted ones from the project row when not streaming.
  const questions = state.streamingQuestions ?? project.pending_questions ?? [];

  async function handleGenerate(answers?: Record<string, string>) {
    if (submitting || isStreaming) return;
    try {
      setSubmitting(true);
      reset();
      // First-turn special case: if no answers were provided AND the
      // user typed something into the initial-context textarea, fold
      // it into a synthetic answers map under the FREE_COMMENT_ID key
      // so the backend prompt receives it as `userContext`.
      let effectiveAnswers = answers;
      if (!hasDoc && !answers && initialContext.trim()) {
        effectiveAnswers = { _user_comment: initialContext.trim() };
      }
      await onGenerate(effectiveAnswers);
      // Primary refetch: the HTTP POST only returns AFTER the calling
      // service has persisted doc_concept / pending_questions to the
      // DB, so this is the FIRST safe moment to read the new state.
      // The useEffect on `state.status === 'done'` is a safety net for
      // tab-navigation cases (it loses races against this path).
      await refetchProject(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelGeneration(project.id, phase);
      toast('Generation cancelled');
    } catch { /* non-fatal */ }
  }

  async function handleApprove() {
    try {
      setSubmitting(true);
      await onApprove(comment.trim() || undefined);
      // Refetch so the new status (and the new phase component) takes
      // over without requiring a page refresh.
      await refetchProject(project.id);
      toast.success('Fase aprobada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Sparkles size={14} style={{ color: 'var(--amber)' }} />
          {title}
        </h2>
        <div style={{ flex: 1 }} />
        {state.tokensUsed > 0 && !isPast && (
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            {state.tokensUsed} tokens
          </span>
        )}
        {isPast ? (
          <RewindButton projectId={project.id} target={phase} />
        ) : isStreaming ? (
          <button
            type="button"
            onClick={handleCancel}
            style={toolbarBtnSecondary}
          >
            <Loader2 size={12} className="animate-spin" /> Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={submitting}
            style={toolbarBtnPrimary(submitting)}
          >
            {hasDoc ? <><RefreshCw size={12} /> Regenerar</> : <><Sparkles size={12} /> Generar</>}
          </button>
        )}
      </div>

      {/* Body — split: doc viewer (left) + questions/approve (right).
          In past view we collapse to a single column (read-only). */}
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: isPast ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 360px',
      }}>
        {/* Doc viewer */}
        <div style={{ overflowY: 'auto', padding: '24px 32px' }}>
          {state.status === 'error' && (
            <div style={errorBanner}>
              <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Error generando el documento.</strong>
                <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: '0.75rem' }}>{state.error}</div>
              </div>
            </div>
          )}

          {!hasDoc && state.status === 'idle' && (
            <div style={emptyState}>
              <Sparkles size={24} style={{ color: 'var(--amber)', marginBottom: 8 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                {emptyHint}
              </div>

              {/* First-turn context input — phase-specific copy */}
              {!isPast && initialContextLabel && (
                <div style={{
                  marginTop: 18, width: '100%', maxWidth: 520, textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <label style={{
                    fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500,
                  }}>
                    {initialContextLabel} <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                  </label>
                  <textarea
                    value={initialContext}
                    onChange={(e) => setInitialContext(e.target.value)}
                    placeholder={initialContextPlaceholder ?? ''}
                    rows={5}
                    style={{
                      padding: 10, fontSize: '0.8125rem',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      resize: 'vertical',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    disabled={submitting}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6,
                      padding: '10px 20px',
                      background: 'var(--amber)', color: '#000',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem', fontWeight: 600,
                      cursor: submitting ? 'wait' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      marginTop: 4,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Sparkles size={14} />
                    Generar
                  </button>
                  <div style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted)',
                    marginTop: 4,
                  }}>
                    Si lo dejas en blanco, se usará sólo la información del scope.
                  </div>
                </div>
              )}
            </div>
          )}

          {hasDoc && <StreamingMarkdown text={displayText} streaming={isStreaming} />}

          {isStreaming && state.text.length === 0 && (
            <div style={loadingHint}>
              <Loader2 size={14} className="animate-spin" /> Studio Builder está pensando…
            </div>
          )}
        </div>

        {/* Right rail: question cards + approve panel. Hidden in past
            view — destructive actions live behind the rewind button. */}
        {!isPast && (
        <aside style={{
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
          padding: 16,
          display: 'flex', flexDirection: 'column', gap: 16,
          background: 'var(--surface)',
        }}>
          {!isStreaming && hasDoc && (
            <QuestionCardsPanel
              questions={questions}
              busy={submitting}
              onSubmit={(answers) => handleGenerate(answers)}
            />
          )}

          {!isStreaming && hasDoc && (
            <div style={{
              padding: 16, background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <h3 style={{
                fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle2 size={14} style={{ color: '#22c55e' }} /> Aprobar
              </h3>
              <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Si el documento refleja lo que querías, apruébalo para pasar a la siguiente fase.
                {questions.length > 0 && ' Puedes responder primero las preguntas pendientes para afinar el documento.'}
              </p>

              {withApprovalComment && (
                <>
                  {!showCommentBox ? (
                    <button
                      type="button"
                      onClick={() => setShowCommentBox(true)}
                      style={{
                        background: 'transparent', border: 'none', padding: 0,
                        color: 'var(--text-dim)', fontSize: '0.6875rem', textAlign: 'left',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        textDecoration: 'underline',
                      }}
                    >
                      + Añadir comentario antes de aprobar
                    </button>
                  ) : (
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Comentario opcional…"
                      rows={3}
                      style={{
                        padding: 8, fontSize: '0.75rem', background: 'var(--surface)',
                        color: 'var(--text)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', resize: 'vertical',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 14px',
                  background: '#22c55e', color: '#000',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {approveLabel}
              </button>
            </div>
          )}
        </aside>
        )}
      </div>

      <StreamDebugOverlay
        state={state}
        debug={debug}
        projectId={project.id}
        phase={phase}
      />
    </div>
  );
}

const toolbarBtnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const toolbarBtnPrimary = (submitting: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: submitting ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});

const errorBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: 14, marginBottom: 16,
  background: 'color-mix(in srgb, var(--danger) 12%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--danger) 40%, var(--border))',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)', fontSize: '0.8125rem',
};

const emptyState: React.CSSProperties = {
  padding: 32, textAlign: 'center',
  background: 'var(--card)',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
};

const loadingHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  color: 'var(--text-dim)', fontSize: '0.8125rem',
};

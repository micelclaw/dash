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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle, CheckCircle2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject, type StudioProjectStatus } from '@/stores/studio.store';
import { useStudioStream } from '../hooks/useStudioStream';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { QuestionCardsPanel } from '../components/QuestionCardsPanel';
import { RewindButton } from '../components/RewindButton';
import { StreamDebugOverlay } from '../components/StreamDebugOverlay';
import { PhaseSidebar } from '../components/PhaseSidebar';
import { FriendlyError } from '../components/v2/FriendlyError';
import { FichaView } from '../components/FichaView';
import { parseFicha, fichaHasContent } from '../lib/ficha';
import { parseVisuals } from '../lib/mockups';
import { useStudioMode } from '../hooks/useStudioMode';
import { listDesignPages } from '../design/design.service';
import { ViewDesignModal } from '../design/ViewDesignModal';


// Human, Spanish chrome for each doc phase in Guided mode (§3.3–3.5).
// Only the surrounding copy changes — the generated document body is
// the same. The deeper "ficha" (qué hará / incluye / no incluye, hitos
// de obra) would need structured sections from the backend prompt.
const GUIDED_COPY: Record<'concept' | 'frontend' | 'foundation', {
  title: string; empty: string; approve: string; approveHeader: string; approveBody: string;
  contextLabel: string; placeholder: string; generate: string; regenerate: string; thinking: string;
}> = {
  concept: {
    title: 'Here\'s what I understood',
    empty: 'I\'ll turn your idea into a clear summary for you to confirm.',
    approve: 'Yes, that\'s it · Continue',
    approveHeader: 'Is this what you had in mind?',
    approveBody: 'If it looks right, we\'ll continue. If something\'s off, tell me and I\'ll adjust it.',
    contextLabel: 'Want to add anything about your idea?',
    placeholder: 'E.g.: who it\'s for, what matters most, anything you already have in mind…',
    generate: 'Prepare my summary', regenerate: 'Try again', thinking: 'Understanding your idea…',
  },
  frontend: {
    title: 'How it will look',
    empty: 'Let\'s give your app a look.',
    approve: 'I like it · Continue',
    approveHeader: 'Do you like how it looks?',
    approveBody: 'If you\'re happy with it, we\'ll continue. You can ask for changes anytime.',
    contextLabel: 'How do you picture it looking?',
    placeholder: 'E.g.: sleek and minimal, fresh and colorful, your colors or your logo…',
    generate: 'Propose a design', regenerate: 'Try another', thinking: 'Designing…',
  },
  foundation: {
    title: 'The build plan',
    empty: 'I\'ll prepare the plan to build your app.',
    approve: 'Start building →',
    approveHeader: 'Shall we start with this plan?',
    approveBody: 'Nothing gets built until you approve it. You can ask for changes first.',
    contextLabel: 'Anything you\'ve already decided or prefer?',
    placeholder: 'E.g.: something you\'ve already decided, a preference, an important detail…',
    generate: 'Prepare the plan', regenerate: 'Redo the plan', thinking: 'Preparing the plan…',
  },
};

export interface DocPhaseLayoutProps {
  project: StudioProject;
  /** Phase identifier matching the WS event payload + cancel route. */
  // Solo 'foundation'. Este layout nació sirviendo a las tres fases de
  // documento; ADR-18 retiró concept y frontend del viaje (hoy se derivan en
  // silencio) y su único consumidor es FoundationPhase. El tipo ancho dejaba
  // pasar un `target` de rewind hacia un estado sin pantalla.
  phase: 'foundation';
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
   *   - "Tell me about your project" (concept)
   *   - "How do you imagine the UI?" (frontend)
   *   - "Technical constraints or decisions already made" (foundation)
   */
  initialContextLabel?: string;
  /** Placeholder for the same textarea. */
  initialContextPlaceholder?: string;
  /** Pipeline navigation callback (forwarded from ProjectDetailPage). */
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

export function DocPhaseLayout(props: DocPhaseLayoutProps) {
  const {
    project, phase, docKey, title, emptyHint, approveLabel,
    withApprovalComment, onGenerate, onApprove,
    viewMode = 'edit',
    initialContextLabel,
    initialContextPlaceholder,
    onSelectPhase,
  } = props;
  const isPast = viewMode === 'past';
  // First-turn context textarea state. Only used when the empty state
  // is rendered (no doc yet). On submit, we pack it into
  // `_user_comment` so the backend `concept.service` extracts it and
  // passes it as `userContext` to the initial prompt.
  const [initialContext, setInitialContext] = useState('');
  // "View design" pill: when the project already has settled Design-mode
  // pages (no variant_group = chosen, not A/B candidates), surface a small
  // peek button in the toolbar of the Concept/Foundation phases.
  const [hasDesignPages, setHasDesignPages] = useState(false);
  const [showDesignModal, setShowDesignModal] = useState(false);

  const cancelGeneration = useStudioStore((s) => s.cancelGeneration);
  const refetchProject = useStudioStore((s) => s.refetchProject);
  const [studioMode] = useStudioMode();
  const guided = studioMode === 'guided';
  const gc = GUIDED_COPY[phase];

  const { state, reset, debug } = useStudioStream(project.id, phase);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  // A5: the stream store is global (per project+phase) and survives across
  // mounts. A stale `status:'done'` from a PREVIOUS visit must not win over
  // the persisted doc — otherwise, after a rewind clears this phase's doc, we
  // would render the deleted text as if current. Only trust a 'done' stream
  // when the generation actually happened during THIS mount.
  const didGenerateRef = useRef(false);

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

  // Mount-time refetch: covers the case where the user navigated
  // away mid-stream and the doc was persisted (or reconciled
  // server-side from the OC session) while they were on another
  // phase. Without this they'd land back on a stale project state.
  // The backend GET self-heals via `reconcileDocPhaseFromOpencode`,
  // so this is also what triggers recovery when Core died mid-stream.
  useEffect(() => {
    // New (project, phase) view → any 'done' stream is from a prior visit
    // until this mount generates again (A5).
    didGenerateRef.current = false;
    refetchProject(project.id).catch(() => {});
    // Run only on (project, phase) change — NOT on every state.status flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, phase]);

  // "View design" pill probe — fires ONCE per (project, phase) mount, only
  // en la fase del plan. If the project has Design-mode pages
  // that are already settled (no variant_group), the pill shows up so the
  // user can peek at the chosen design while reading the docs.
  useEffect(() => {
    let cancelled = false;
    listDesignPages(project.id)
      .catch(() => null)
      .then((res) => {
        if (cancelled || !res) return;
        setHasDesignPages(res.pages.some((p) => !p.variant_group));
      });
    return () => { cancelled = true; };
  }, [phase, project.id]);





  const isStreaming = state.status === 'starting' || state.status === 'streaming';
  const docFromProject = (project[docKey] ?? '') as string;
  // During streaming we render the parsed body (between DOC_BODY
  // sentinels) to avoid showing the raw `<!-- DOC_BODY_START -->`
  // markers and the inline JSON of pending questions to the user.
  // `state.displayBody` falls back gracefully when sentinels haven't
  // arrived yet.
  // Prefer the live stream while streaming, or a 'done' stream ONLY if it
  // was produced in this mount (A5); otherwise fall back to the persisted
  // doc (which is authoritative after a rewind).
  const streamIsCurrent = isStreaming || (state.status === 'done' && didGenerateRef.current);
  const displayText = streamIsCurrent
    ? (state.displayBody || state.text)
    : docFromProject;
  const hasDoc = displayText.length > 0;
  // V3-4: extract the structured "ficha" (Concept agreement card / Foundation
  // build plan) the doc-phase emitted as a `<!-- claw-ficha … -->` comment, and
  // strip it from the markdown. Absent/malformed → markdown fallback (no regression).
  const { ficha, body: fichaBody } = useMemo(() => parseFicha(displayText), [displayText]);
  const showFicha = guided && fichaHasContent(phase, ficha);
  // A3 (Frontend): extract the wireframes + mockups comments from the body
  // (after the ficha is already stripped) so the markdown shown behind
  // "Ver detalles" is clean, and we render the visuals as cards/iframes.
  // Frontend has NO ficha, so `fichaBody` === the body for this phase.
  const visuals = useMemo(() => parseVisuals(fichaBody), [fichaBody]);
  const cleanDocText = visuals.body;

  // Questions: prefer the LIVE-streamed ones (parsed incrementally
  // from the WS token stream as soon as the JSON block closes), fall
  // back to the persisted ones from the project row when not streaming.
  const questions = state.streamingQuestions ?? project.pending_questions ?? [];

  async function handleGenerate(answers?: Record<string, string>) {
    if (submitting || isStreaming) return;
    try {
      setSubmitting(true);
      didGenerateRef.current = true; // A5: this mount owns the stream now
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
      toast.error(err instanceof Error ? err.message : (guided ? 'No pude prepararlo' : 'Generation failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelGeneration(project.id, phase);
      toast(guided ? 'Cancelado' : 'Generation cancelled');
    } catch { /* non-fatal */ }
  }

  async function handleApprove() {
    try {
      setSubmitting(true);
      await onApprove(comment.trim() || undefined);
      // Refetch so the new status (and the new phase component) takes
      // over without requiring a page refresh.
      await refetchProject(project.id);
      toast.success(guided ? 'Done! On to the next step' : 'Phase approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (guided ? 'No se pudo continuar' : 'Approval failed'));
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
          {guided ? gc.title : title}
        </h2>
        <div style={{ flex: 1 }} />
        {hasDesignPages && (
          <button
            type="button"
            onClick={() => setShowDesignModal(true)}
            style={toolbarBtnGhost}
          >
            <Palette size={12} /> View design
          </button>
        )}
        {state.tokensUsed > 0 && !isPast && !guided && (
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            {state.tokensEstimated ? '≈' : ''}{state.tokensUsed} tokens
            {state.tokensEstimated && (
              <span title="The provider reported no usage, so this is our estimate"> (estimated)</span>
            )}
          </span>
        )}
        {isPast ? (
          // Rewind is blocked for protected states (published/frozen/archived) —
          // showing it there would error (same class as the living-app B-2 bug).
          // A published app is reviewed read-only; "go back to edit" only applies
          // to a project still mid-journey. Pass `guided` for Spanish copy.
          ['published', 'frozen', 'archived'].includes(project.status)
            ? null
            : <RewindButton projectId={project.id} target={phase} projectTarget={project.target} guided={guided} />
        ) : isStreaming ? (
          <button
            type="button"
            onClick={handleCancel}
            style={toolbarBtnSecondary}
          >
            <Loader2 size={12} className="animate-spin" /> {guided ? 'Detener' : 'Cancel'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={submitting}
            style={toolbarBtnPrimary(submitting)}
          >
            {hasDoc
              ? <><RefreshCw size={12} /> {guided ? gc.regenerate : 'Regenerate'}</>
              : <><Sparkles size={12} /> {guided ? gc.generate : 'Generate'}</>}
          </button>
        )}
      </div>

      {/* Pipeline strip (horizontal navigator across all phases) */}
      <PhaseSidebar project={project} viewedPhase={phase} onSelect={onSelectPhase} guided={guided} />

      {/* Body — split: doc viewer (left) + questions/approve (right).
          In past view we collapse to a single column (read-only). */}
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: isPast ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 360px',
      }}>
        {/* Doc viewer */}
        <div style={{ overflowY: 'auto', padding: '24px 32px' }}>
          {state.status === 'error' && (guided ? (
            <FriendlyError
              title="No pude prepararlo esta vez"
              message="Casi siempre se arregla al reintentar."
              detail={state.error ?? undefined}
              actions={[{ label: 'Reintentar', onClick: () => { void handleGenerate(); }, primary: true }]}
            />
          ) : (
            <div style={errorBanner}>
              <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Error generating the document.</strong>
                <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: '0.75rem' }}>{state.error}</div>
              </div>
            </div>
          ))}

          {/* The model stopped because it ran out of output room, not because
              it finished. Without this the document just LOOKS complete — and
              with providers that report no token usage (tokens_used = 0) there
              is no other clue. Never blocks: the text is saved and useful. */}
          {state.truncatedByModel && state.status === 'done' && hasDoc && (
            <div style={truncatedBanner}>
              <AlertCircle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>{guided ? 'Se quedó a medias.' : 'The model ran out of room.'}</strong>
                <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                  {guided
                    ? 'El texto está cortado por el final, no terminado. Vuelve a generarlo para tenerlo entero.'
                    : 'This document is cut off at the end, not finished. Regenerate it to get the rest.'}
                </div>
              </div>
            </div>
          )}

          {!hasDoc && state.status === 'idle' && (
            <div style={emptyState}>
              <Sparkles size={24} style={{ color: 'var(--amber)', marginBottom: 8 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                {guided ? gc.empty : emptyHint}
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
                    {guided ? gc.contextLabel : initialContextLabel} <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <textarea
                    value={initialContext}
                    onChange={(e) => setInitialContext(e.target.value)}
                    placeholder={guided ? gc.placeholder : (initialContextPlaceholder ?? '')}
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
                    {guided ? gc.generate : 'Generate'}
                  </button>
                  <div style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted)',
                    marginTop: 4,
                  }}>
                    {guided ? "If you leave it blank, I'll use what you already told me." : 'If you leave it blank, only the scope info will be used.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {state.reasoning && state.reasoning.length > 0 && (
            <details
              open={isStreaming || !hasDoc}
              style={{
                margin: '0 0 16px 0',
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--text-muted) 6%, transparent)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontStyle: 'italic',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              <summary style={{
                cursor: 'pointer', fontStyle: 'normal',
                fontSize: '0.65rem', textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: 4,
              }}>
                {guided ? 'How it\'s thinking' : 'Builder reasoning'} {isStreaming && (guided ? '· live…' : '· streaming…')}
              </summary>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>
                {state.reasoning}
              </div>
            </details>
          )}

          {/* Concept / Foundation in Guided: structured "ficha" card +
              technical markdown behind a "Ver detalles" toggle. */}
          {hasDoc && showFicha && ficha && (
            <>
              <FichaView phase={phase} ficha={ficha} />
              {cleanDocText.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={detailsSummary}>Ver detalles</summary>
                  <div style={{ marginTop: 8 }}>
                    <StreamingMarkdown text={cleanDocText} streaming={false} />
                  </div>
                </details>
              )}
            </>
          )}


          {/* Sin ficha (modo Pro o payload malformado) — markdown a secas. */}
          {hasDoc && !showFicha && (
            <StreamingMarkdown text={cleanDocText} streaming={isStreaming} />
          )}

          {isStreaming && state.text.length === 0 && state.reasoning.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              <div style={loadingHint}>
                <Loader2 size={14} className="animate-spin" /> {guided ? gc.thinking : 'Studio Builder is thinking…'}
              </div>
              {/* UX-1: a document skeleton so the (slow) generating state reads
                  as "working", not a blank/stuck screen (R-B). */}
              <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
                {[18, 12, 12, 12, 12, 12, 12].map((h, i) => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      height: h,
                      width: `${[55, 92, 84, 96, 70, 88, 44][i]}%`,
                      borderRadius: 6,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {guided
                  ? 'This usually takes a minute or two — you can leave it open, I\'ll keep working.'
                  : 'This can take a minute for a complex prompt. Keep this tab open.'}
              </div>
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
              preamble={project.last_preamble ?? null}
              busy={submitting}
              onSubmit={(answers) => handleGenerate(answers)}
              phase={phase}
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
                <CheckCircle2 size={14} style={{ color: '#22c55e' }} /> {guided ? gc.approveHeader : 'Approve'}
              </h3>
              <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {guided
                  ? gc.approveBody
                  : <>If the document reflects what you wanted, approve it to move on to the next phase.
                      {questions.length > 0 && ' You can answer the pending questions first to refine the document.'}</>}
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
                      {guided ? '+ Quiero comentar algo antes' : '+ Add a comment before approving'}
                    </button>
                  ) : (
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Optional comment…"
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
                {guided ? gc.approve : approveLabel}
              </button>
            </div>
          )}
        </aside>
        )}
      </div>

      {showDesignModal && (
        <ViewDesignModal projectId={project.id} onClose={() => setShowDesignModal(false)} />
      )}

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

/** Small ghost button for the toolbar (e.g. the "View design" pill). */
const toolbarBtnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 10px', background: 'transparent',
  border: 'none', borderRadius: 'var(--radius-md)',
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

const truncatedBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: 14, marginBottom: 16,
  background: 'color-mix(in srgb, var(--amber) 12%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--amber) 40%, var(--border))',
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

const detailsSummary: React.CSSProperties = {
  cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600,
  listStyle: 'none', userSelect: 'none',
};

/** CTA shown under the wireframes to generate the rendered HTML mockups
 *  ("así se verá tu app") — the dedicated mockups step. */

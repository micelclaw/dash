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

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle, CheckCircle2, Search, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject, type StudioProjectStatus, type StudioDesignSystem } from '@/stores/studio.store';
import { useStudioStream } from '../hooks/useStudioStream';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { QuestionCardsPanel } from '../components/QuestionCardsPanel';
import { RewindButton } from '../components/RewindButton';
import { StreamDebugOverlay } from '../components/StreamDebugOverlay';
import { PhaseSidebar } from '../components/PhaseSidebar';
import { FriendlyError } from '../components/v2/FriendlyError';
import { DesignPreview } from '../components/DesignPreview';
import { FichaView } from '../components/FichaView';
import { parseFicha, fichaHasContent } from '../lib/ficha';
import { useStudioMode } from '../hooks/useStudioMode';

// Frontend "feel" moods (§3.4) — each maps to a short hint folded into
// the generation context so the DESIGN.md comes out in that character.
const FEELS: { id: string; emoji: string; label: string; hint: string }[] = [
  { id: 'elegant', emoji: '🖤', label: 'Elegante y sobria', hint: 'tonos neutros, mucho espacio, tipografía fina' },
  { id: 'fresh', emoji: '🌈', label: 'Fresca y colorida', hint: 'colores vivos, alegre, con energía' },
  { id: 'warm', emoji: '🧡', label: 'Cálida y cercana', hint: 'tonos cálidos, redondeada, amable' },
  { id: 'minimal', emoji: '⚪', label: 'Minimal y limpia', hint: 'blanco, esencial, sin adornos' },
];

// Human, Spanish chrome for each doc phase in Guided mode (§3.3–3.5).
// Only the surrounding copy changes — the generated document body is
// the same. The deeper "ficha" (qué hará / incluye / no incluye, hitos
// de obra) would need structured sections from the backend prompt.
const GUIDED_COPY: Record<'concept' | 'frontend' | 'foundation', {
  title: string; empty: string; approve: string; approveHeader: string; approveBody: string;
  contextLabel: string; placeholder: string; generate: string; regenerate: string; thinking: string;
}> = {
  concept: {
    title: 'Esto es lo que entendí',
    empty: 'Voy a resumir tu idea en una ficha clara para que la confirmes.',
    approve: 'Sí, es esto · Continuar',
    approveHeader: '¿Es esto lo que tenías en mente?',
    approveBody: 'Si te cuadra, seguimos. Si algo no encaja, dímelo y lo ajusto.',
    contextLabel: '¿Quieres añadir algo sobre tu idea?',
    placeholder: 'Ej.: para quién es, qué es lo más importante, algo que ya tengas claro…',
    generate: 'Preparar mi ficha', regenerate: 'Volver a intentarlo', thinking: 'Entendiendo tu idea…',
  },
  frontend: {
    title: 'Cómo se va a ver',
    empty: 'Vamos a darle aspecto a tu app.',
    approve: 'Me gusta · Continuar',
    approveHeader: '¿Te gusta cómo se verá?',
    approveBody: 'Si te convence, seguimos. Puedes pedirme cambios cuando quieras.',
    contextLabel: '¿Cómo te imaginas que se vea?',
    placeholder: 'Ej.: elegante y sobria, fresca y colorida, tus colores o tu logo…',
    generate: 'Proponer un diseño', regenerate: 'Probar otro', thinking: 'Diseñando…',
  },
  foundation: {
    title: 'El plan de construcción',
    empty: 'Voy a preparar el plan para construir tu app.',
    approve: 'Empezar a construir →',
    approveHeader: '¿Empezamos con este plan?',
    approveBody: 'Nada se construye hasta que tú lo apruebes. Puedes pedir cambios antes.',
    contextLabel: '¿Algo que ya tengas decidido o prefieras?',
    placeholder: 'Ej.: algo que ya tengas decidido, una preferencia, un dato importante…',
    generate: 'Preparar el plan', regenerate: 'Rehacer el plan', thinking: 'Preparando el plan…',
  },
};

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
  // Frontend "feel" pre-step (Guided, §3.4): a mood + brand colors that
  // steer the DESIGN.md the Frontend phase emits. Folded into the
  // first-turn user context. Only shown for phase==='frontend' + guided.
  const [feel, setFeel] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState('');
  // S4: "start from a known design" — catalog picker (Frontend, Guided).
  const [dsQuery, setDsQuery] = useState('');
  const [dsResults, setDsResults] = useState<StudioDesignSystem[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  // The bound base system is project state (persisted server-side).
  const selectedSystem = project.design_system;

  const cancelGeneration = useStudioStore((s) => s.cancelGeneration);
  const refetchProject = useStudioStore((s) => s.refetchProject);
  const searchDesignSystems = useStudioStore((s) => s.searchDesignSystems);
  const setDesignSystem = useStudioStore((s) => s.setDesignSystem);
  const [studioMode] = useStudioMode();
  const guided = studioMode === 'guided';
  const gc = GUIDED_COPY[phase];

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

  // Mount-time refetch: covers the case where the user navigated
  // away mid-stream and the doc was persisted (or reconciled
  // server-side from the OC session) while they were on another
  // phase. Without this they'd land back on a stale project state.
  // The backend GET self-heals via `reconcileDocPhaseFromOpencode`,
  // so this is also what triggers recovery when Core died mid-stream.
  useEffect(() => {
    refetchProject(project.id).catch(() => {});
    // Run only on (project, phase) change — NOT on every state.status flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, phase]);

  // S4: load the catalog for the Frontend picker (debounced on query).
  // Only fetches while the picker is on screen (frontend + guided + no doc).
  const showPicker = !isPast && guided && phase === 'frontend';
  useEffect(() => {
    if (!showPicker) return;
    let cancelled = false;
    setDsLoading(true);
    const timer = setTimeout(() => {
      searchDesignSystems(dsQuery.trim() || undefined)
        .then((rows) => { if (!cancelled) setDsResults(rows.slice(0, 12)); })
        .catch(() => { if (!cancelled) setDsResults([]); })
        .finally(() => { if (!cancelled) setDsLoading(false); });
    }, dsQuery ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showPicker, dsQuery, searchDesignSystems]);

  async function pickSystem(slug: string | null) {
    try {
      await setDesignSystem(project.id, slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pude guardar el diseño base');
    }
  }

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
  // V3-4: extract the structured "ficha" (Concept agreement card / Foundation
  // build plan) the doc-phase emitted as a `<!-- claw-ficha … -->` comment, and
  // strip it from the markdown. Absent/malformed → markdown fallback (no regression).
  const { ficha, body: cleanDocText } = useMemo(() => parseFicha(displayText), [displayText]);
  const showFicha = guided && fichaHasContent(phase, ficha);
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
      if (!hasDoc && !answers) {
        // Compose the first-turn context. For the Frontend phase in
        // Guided mode, fold the chosen "feel" + brand colors in front of
        // any free text so the emitted DESIGN.md is on-brand (§3.4).
        const parts: string[] = [];
        if (guided && phase === 'frontend' && feel) {
          const f = FEELS.find((x) => x.id === feel);
          if (f) parts.push(`Sensación deseada: ${f.label} — ${f.hint}.`);
          if (brandColors.trim()) parts.push(`Colores/marca: ${brandColors.trim()}.`);
        }
        if (initialContext.trim()) parts.push(initialContext.trim());
        if (parts.length > 0) effectiveAnswers = { _user_comment: parts.join(' ') };
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
      toast.success(guided ? '¡Listo! Pasamos a lo siguiente' : 'Phase approved');
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
        {state.tokensUsed > 0 && !isPast && !guided && (
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
              detail={state.error}
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

          {!hasDoc && state.status === 'idle' && (
            <div style={emptyState}>
              <Sparkles size={24} style={{ color: 'var(--amber)', marginBottom: 8 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                {guided ? gc.empty : emptyHint}
              </div>

              {/* "Feel" pre-step (Frontend, Guided, §3.4): mood + brand
                  colors steer the DESIGN.md the phase emits. */}
              {!isPast && guided && phase === 'frontend' && (
                <div style={{ marginTop: 16, width: '100%', maxWidth: 520, textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
                    ¿Cómo quieres que se sienta tu app?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {FEELS.map((f) => {
                      const sel = feel === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFeel(sel ? null : f.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', textAlign: 'left',
                            background: sel ? 'color-mix(in srgb, var(--amber) 12%, var(--card))' : 'var(--card)',
                            border: `1.5px solid ${sel ? 'var(--amber)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            color: 'var(--text)',
                          }}
                        >
                          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{f.emoji}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={brandColors}
                    onChange={(e) => setBrandColors(e.target.value)}
                    placeholder="Tus colores o tu logo (opcional): ej. 'rosa y dorado'"
                    style={{
                      marginTop: 10, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                      fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />

                  {/* "…or start from a known design" — catalog picker (S4). */}
                  <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Palette size={14} style={{ color: 'var(--text-muted)' }} />
                    …o parte de un diseño que ya te guste
                  </div>
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      value={dsQuery}
                      onChange={(e) => setDsQuery(e.target.value)}
                      placeholder="Buscar: stripe, notion, material…"
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px',
                        fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                    {dsResults.map((ds) => {
                      const sel = selectedSystem === ds.slug;
                      return (
                        <button
                          key={ds.slug}
                          type="button"
                          onClick={() => pickSystem(sel ? null : ds.slug)}
                          title={ds.has_brand ? `${ds.name} (inspirado en — solo tokens)` : ds.name}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', textAlign: 'left',
                            background: sel ? 'color-mix(in srgb, var(--amber) 12%, var(--card))' : 'var(--card)',
                            border: `1.5px solid ${sel ? 'var(--amber)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            color: 'var(--text)', minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {ds.has_brand ? 'inspirado en' : ds.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {dsLoading && dsResults.length === 0 && (
                    <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Buscando…</div>
                  )}
                  {selectedSystem && (
                    <>
                      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Diseño base: <strong style={{ color: 'var(--text)' }}>{selectedSystem}</strong>
                        {' · '}
                        <button
                          type="button"
                          onClick={() => pickSystem(null)}
                          style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', padding: 0, font: 'inherit' }}
                        >
                          quitar
                        </button>
                      </div>
                      <DesignPreview slug={selectedSystem} />
                    </>
                  )}
                  <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Siempre incluyo accesibilidad, responsive, buenos nombres y patrones de componentes.
                  </div>
                </div>
              )}

              {/* First-turn context input — phase-specific copy */}
              {!isPast && initialContextLabel && (
                <div style={{
                  marginTop: 18, width: '100%', maxWidth: 520, textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <label style={{
                    fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500,
                  }}>
                    {guided ? gc.contextLabel : initialContextLabel} <span style={{ color: 'var(--text-muted)' }}>{guided ? '(opcional)' : '(optional)'}</span>
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
                    {guided ? 'Si lo dejas en blanco, uso lo que ya me contaste.' : 'If you leave it blank, only the scope info will be used.'}
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
                {guided ? 'Cómo lo está pensando' : 'Builder reasoning'} {isStreaming && (guided ? '· en directo…' : '· streaming…')}
              </summary>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>
                {state.reasoning}
              </div>
            </details>
          )}

          {hasDoc && showFicha && ficha && (
            <>
              <FichaView phase={phase} ficha={ficha} />
              {cleanDocText.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{
                    cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600,
                    listStyle: 'none', userSelect: 'none',
                  }}>
                    Ver detalles
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    <StreamingMarkdown text={cleanDocText} streaming={false} />
                  </div>
                </details>
              )}
            </>
          )}
          {hasDoc && !showFicha && <StreamingMarkdown text={cleanDocText} streaming={isStreaming} />}

          {isStreaming && state.text.length === 0 && state.reasoning.length === 0 && (
            <div style={loadingHint}>
              <Loader2 size={14} className="animate-spin" /> {guided ? gc.thinking : 'Studio Builder is thinking…'}
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

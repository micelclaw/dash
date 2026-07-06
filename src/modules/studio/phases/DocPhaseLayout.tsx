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
import { WireframeView } from '../components/WireframeView';
import { MockupPreview } from '../components/MockupPreview';
import { parseFicha, fichaHasContent } from '../lib/ficha';
import { parseVisuals, hasWireframes, hasMockups, defaultTokensFromFeel } from '../lib/mockups';
import { useStudioMode } from '../hooks/useStudioMode';

// Frontend "feel" moods (§3.4) — each maps to a short hint folded into
// the generation context so the DESIGN.md comes out in that character.
const FEELS: { id: string; emoji: string; label: string; hint: string }[] = [
  { id: 'elegant', emoji: '🖤', label: 'Sleek & understated', hint: 'neutral tones, lots of space, fine typography' },
  { id: 'fresh', emoji: '🌈', label: 'Fresh & colorful', hint: 'vivid colors, cheerful, energetic' },
  { id: 'warm', emoji: '🧡', label: 'Warm & friendly', hint: 'warm tones, rounded, approachable' },
  { id: 'minimal', emoji: '⚪', label: 'Minimal & clean', hint: 'white, essential, no clutter' },
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
  // S4 Fase C: live color tweaks on the chosen system ({ primary: "#…" }).
  // Folded into the Frontend generation context (no persistence — the
  // emitted DESIGN.md bakes them in). Reset when the base system changes.
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  // The bound base system is project state (persisted server-side).
  const selectedSystem = project.design_system;
  // A3: tokens CSS of the BOUND catalog system, fetched once so the
  // post-generation mockups can be styled with it (else we fall back to
  // the feel-derived tokens). null while loading / when no system bound.
  const [boundTokensCss, setBoundTokensCss] = useState<string | null>(null);
  // The project's OWN DESIGN.md tokens (from doc_frontend) — the mockups are
  // rendered with THESE so they look on-brand (e.g. the project's dark theme),
  // not the generic feel default. '' when the doc has no DESIGN.md yet.
  const [projectTokensCss, setProjectTokensCss] = useState<string>('');
  const [generatingMockups, setGeneratingMockups] = useState(false);

  const cancelGeneration = useStudioStore((s) => s.cancelGeneration);
  const refetchProject = useStudioStore((s) => s.refetchProject);
  const searchDesignSystems = useStudioStore((s) => s.searchDesignSystems);
  const setDesignSystem = useStudioStore((s) => s.setDesignSystem);
  const fetchDesignSystemTokens = useStudioStore((s) => s.fetchDesignSystemTokens);
  const generateMockups = useStudioStore((s) => s.generateMockups);
  const fetchProjectDesignTokens = useStudioStore((s) => s.fetchProjectDesignTokens);
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
      setColorOverrides({}); // tweaks belong to a system; reset on change
      await setDesignSystem(project.id, slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t save the base design');
    }
  }

  // A3: fetch the bound catalog system's derived tokens so the mockups can
  // be styled with the user's actual design (else feel-derived fallback).
  useEffect(() => {
    if (!selectedSystem) { setBoundTokensCss(null); return; }
    let cancelled = false;
    fetchDesignSystemTokens(selectedSystem)
      .then((css) => { if (!cancelled) setBoundTokensCss(css); })
      .catch(() => { if (!cancelled) setBoundTokensCss(null); });
    return () => { cancelled = true; };
  }, [selectedSystem, fetchDesignSystemTokens]);

  // The project's OWN DESIGN.md tokens (highest priority for mockups). Fetched
  // on the frontend phase; deterministic server-side derivation, so it reflects
  // exactly what the Build phase will use.
  useEffect(() => {
    if (phase !== 'frontend') return;
    let cancelled = false;
    fetchProjectDesignTokens(project.id)
      .then((css) => { if (!cancelled) setProjectTokensCss(css || ''); })
      .catch(() => { if (!cancelled) setProjectTokensCss(''); });
    return () => { cancelled = true; };
    // Re-fetch when the frontend doc changes (a new DESIGN.md may have landed).
  }, [phase, project.id, project.doc_frontend, fetchProjectDesignTokens]);

  // A3: feel-derived tokens for the ALWAYS-ON brand preview + the mockups
  // fallback. Deterministic, no network — built from the Guided "feel" +
  // free-text brand colors + the project name.
  const feelTokensCss = useMemo(
    () => defaultTokensFromFeel(feel, brandColors, project.name),
    [feel, brandColors, project.name],
  );

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
  const showWireframes = phase === 'frontend' && hasWireframes(visuals);
  // Resolve the tokens CSS for the mockups, in priority order:
  //  1. the project's OWN DESIGN.md tokens (what the app is actually built with),
  //  2. the bound catalog system's tokens (if the user picked one),
  //  3. the Guided feel-derived default (always non-empty).
  const mockupTokensCss = projectTokensCss
    || (selectedSystem ? (boundTokensCss ?? '') : '')
    || feelTokensCss;
  const showMockups = phase === 'frontend' && hasMockups(visuals) && mockupTokensCss.length > 0;

  // "Ver cómo se verá (HTML)" — the dedicated mockups step. Shown after the
  // wireframes when no mockups exist yet (matches the user's flow: ASCII first,
  // then the HTML on demand). One click → generate → re-render with MockupPreview.
  async function handleGenerateMockups() {
    if (generatingMockups) return;
    setGeneratingMockups(true);
    try {
      const out = await generateMockups(project.id);
      await refetchProject(project.id);
      try { setProjectTokensCss((await fetchProjectDesignTokens(project.id)) || ''); } catch { /* keep prior */ }
      if (out.fell_back) {
        toast('Mockups ready (basic version — the model didn\'t return full HTML).');
      } else {
        toast.success('Bocetos en HTML listos');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pude generar los bocetos');
    } finally {
      setGeneratingMockups(false);
    }
  }
  const canGenerateMockups = phase === 'frontend' && showWireframes && !showMockups;
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
      if (!hasDoc && !answers) {
        // Compose the first-turn context. For the Frontend phase in
        // Guided mode, fold the chosen "feel" + brand colors in front of
        // any free text so the emitted DESIGN.md is on-brand (§3.4).
        const parts: string[] = [];
        if (guided && phase === 'frontend') {
          if (feel) {
            const f = FEELS.find((x) => x.id === feel);
            if (f) parts.push(`Sensación deseada: ${f.label} — ${f.hint}.`);
          }
          if (brandColors.trim()) parts.push(`Colores/marca: ${brandColors.trim()}.`);
          // S4 Fase C — fold the user's color tweaks so the DESIGN.md bakes them in.
          const ov = Object.entries(colorOverrides);
          if (ov.length > 0) {
            parts.push(`Ajusta estos colores exactos en el DESIGN.md: ${ov.map(([k, v]) => `${k} ${v}`).join(', ')}.`);
          }
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
        {state.tokensUsed > 0 && !isPast && !guided && (
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            {state.tokensUsed} tokens
          </span>
        )}
        {isPast ? (
          // Rewind is blocked for protected states (published/frozen/archived) —
          // showing it there would error (same class as the living-app B-2 bug).
          // A published app is reviewed read-only; "go back to edit" only applies
          // to a project still mid-journey. Pass `guided` for Spanish copy.
          ['published', 'frozen', 'archived'].includes(project.status)
            ? null
            : <RewindButton projectId={project.id} target={phase} guided={guided} />
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
                  {selectedSystem ? (
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
                      <DesignPreview
                        slug={selectedSystem}
                        overrides={colorOverrides}
                        onOverride={(name, value) => setColorOverrides((prev) => ({ ...prev, [name]: value }))}
                        onResetOverrides={() => setColorOverrides({})}
                      />
                    </>
                  ) : (
                    /* A3: ALWAYS-ON brand preview — even with no system
                       picked, the user sees how their "feel" + colors look.
                       Feel-derived tokens, no fetch (tokensCssOverride). */
                    <DesignPreview tokensCssOverride={feelTokensCss} />
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

          {/* A3 — Frontend visual previews. In Guided: the wireframe cards +
              real mockups come FIRST and the technical markdown sits behind
              "Ver detalles". In Pro: markdown stays primary, visuals below. */}
          {hasDoc && phase === 'frontend' && !showFicha && (
            guided ? (
              <>
                {showWireframes && <WireframeView screens={visuals.wireframes} />}
                {canGenerateMockups && (
                  <MockupsCta generating={generatingMockups} onClick={handleGenerateMockups} guided />
                )}
                {showMockups && <MockupPreview screens={visuals.mockups} tokensCss={mockupTokensCss} />}
                {cleanDocText.length > 0 && (
                  (showWireframes || showMockups) ? (
                    <details style={{ marginBottom: 8 }}>
                      <summary style={detailsSummary}>Ver detalles</summary>
                      <div style={{ marginTop: 8 }}>
                        <StreamingMarkdown text={cleanDocText} streaming={isStreaming} />
                      </div>
                    </details>
                  ) : (
                    <StreamingMarkdown text={cleanDocText} streaming={isStreaming} />
                  )
                )}
              </>
            ) : (
              <>
                <StreamingMarkdown text={cleanDocText} streaming={isStreaming} />
                {showWireframes && <WireframeView screens={visuals.wireframes} />}
                {canGenerateMockups && (
                  <MockupsCta generating={generatingMockups} onClick={handleGenerateMockups} />
                )}
                {showMockups && <MockupPreview screens={visuals.mockups} tokensCss={mockupTokensCss} />}
              </>
            )
          )}

          {/* Everything else (Concept/Foundation without a ficha, e.g. Pro
              mode or malformed payload) — plain markdown fallback. */}
          {hasDoc && phase !== 'frontend' && !showFicha && (
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

const detailsSummary: React.CSSProperties = {
  cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600,
  listStyle: 'none', userSelect: 'none',
};

/** CTA shown under the wireframes to generate the rendered HTML mockups
 *  ("así se verá tu app") — the dedicated mockups step. */
function MockupsCta({ generating, onClick, guided }: { generating: boolean; onClick: () => void; guided?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
      margin: '10px 0 14px',
    }}>
      <button
        type="button"
        onClick={onClick}
        disabled={generating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
          background: generating ? 'var(--card)' : 'var(--amber)',
          color: generating ? 'var(--text-dim)' : '#000',
          border: generating ? '1px solid var(--border)' : 'none',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600,
          cursor: generating ? 'default' : 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {generating
          ? <><Loader2 size={15} className="animate-spin" /> Drawing the mockups…</>
          : <><Sparkles size={15} /> See how it'll look (HTML)</>}
      </button>
      {!generating && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {guided
            ? 'Turn the sketches above into real screens with your design.'
            : 'Generate rendered HTML mockups from the wireframes + design tokens.'}
        </span>
      )}
    </div>
  );
}

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

// ─── Studio Phase 0 — scoping wizard ────────────────────────────────
//
// Vertical stepper that walks Battery 1 → Battery 2 (branch-specific) →
// Battery 3 → Battery 4 (confirmation). NO LLM here. The classifier
// runs on the backend (POST /preview) once the user reaches the summary.

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Hammer } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStudioStore,
  type ScopingTree,
  type ScopingQuestion,
  type ScopingAnswers,
  type ScopingClassification,
  type StudioProject,
  type StudioProjectStatus,
} from '@/stores/studio.store';
import { QuestionCard } from '../components/QuestionCard';
import { ScopeSummary } from '../components/ScopeSummary';
import { RewindButton } from '../components/RewindButton';
import { PhaseSidebar } from '../components/PhaseSidebar';

interface Props {
  projectId: string;
  onComplete: () => void;
  /** When 'past', render a read-only summary instead of the wizard. */
  viewMode?: 'edit' | 'past';
  /** Required in past mode (so we can show the persisted scope). */
  project?: StudioProject;
  /** Pipeline navigation callback. */
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

export function ScopingWizard({ projectId, onComplete, viewMode = 'edit', project, onSelectPhase }: Props) {
  // ── Past view: render the persisted scope as a read-only summary
  if (viewMode === 'past' && project) {
    return <ScopingReadOnly project={project} onSelectPhase={onSelectPhase} />;
  }

  const fetchScopingTree = useStudioStore((s) => s.fetchScopingTree);
  const previewScoping = useStudioStore((s) => s.previewScoping);
  const submitScoping = useStudioStore((s) => s.submitScoping);

  const [tree, setTree] = useState<ScopingTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Hydrate the wizard from any pre-filled answers persisted on the
  // project. Template-instantiated projects ship with their template's
  // presetAnswers in `scoping_answers`; blank projects start with `{}`.
  // We do this once, when the project prop is first available — later
  // edits live in local state until the user submits.
  const [answers, setAnswers] = useState<ScopingAnswers>(
    () => (project?.scoping_answers && Object.keys(project.scoping_answers).length > 0
      ? { ...project.scoping_answers }
      : {}),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [classification, setClassification] = useState<ScopingClassification | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Load tree ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchScopingTree(projectId)
      .then((t) => { if (!cancelled) { setTree(t); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Error loading scoping tree');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId, fetchScopingTree]);

  // ─── Walk the active question list dynamically ───────────
  const questions: ScopingQuestion[] = useMemo(() => {
    if (!tree) return [];
    const intent = answers['b1_intent'];
    const battery2 = intent ? (tree.battery2[intent] ?? []) : [];
    return [tree.battery1, ...battery2, ...tree.battery3];
  }, [tree, answers]);

  const currentQuestion = questions[stepIndex] ?? null;
  const totalSteps = questions.length;
  const isLastStep = stepIndex === totalSteps - 1;

  // ─── Handlers ────────────────────────────────────────────
  function selectOption(optionId: string) {
    if (!currentQuestion) return;
    const next = { ...answers, [currentQuestion.id]: optionId };

    // If we changed the intent, drop any branch-2 answers from the old branch
    if (currentQuestion.id === 'b1_intent' && answers['b1_intent'] !== optionId) {
      for (const k of Object.keys(next)) {
        const q = tree?.battery1.id === k
          ? tree?.battery1
          : tree?.battery3.find((q) => q.id === k);
        const isBattery1Or3 = !!q;
        const isBranchSurvivor = k === 'b1_intent';
        if (!isBattery1Or3 && !isBranchSurvivor) delete next[k];
      }
    }
    setAnswers(next);
  }

  async function goNext() {
    if (!currentQuestion) return;
    if (!answers[currentQuestion.id]) {
      toast.error('Pick an option to continue');
      return;
    }
    if (isLastStep) {
      // Compute preview
      try {
        setSubmitting(true);
        const result = await previewScoping(projectId, answers);
        setClassification(result);
        setShowSummary(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to compute scope');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  }

  function goBack() {
    if (showSummary) {
      setShowSummary(false);
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleConfirm() {
    try {
      setSubmitting(true);
      await submitScoping(projectId, answers);
      toast.success('Scope saved — moving on to concept phase');
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save scope');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading questionnaire…
      </div>
    );
  }

  if (loadError || !tree) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        {loadError ?? 'Could not load questionnaire'}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Progress header */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--text-muted)',
        }}>
          {showSummary
            ? 'Confirmation'
            : `Question ${stepIndex + 1} of ${totalSteps}`}
        </span>
        <div style={{
          flex: 1, height: 4, background: 'var(--surface)',
          borderRadius: 'var(--radius-full)', overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              width: `${showSummary ? 100 : ((stepIndex + 1) / totalSteps) * 100}%`,
              background: 'var(--amber)',
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>

      {/* Pipeline strip — but only when we have a project (the wizard
          is also reachable BEFORE a project row exists; in that case
          there's nothing to navigate to). */}
      {project && (
        <PhaseSidebar project={project} viewedPhase="scoping" onSelect={onSelectPhase} />
      )}

      {/* Body */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 24,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 720, width: '100%' }}>
          {showSummary && classification ? (
            <ScopeSummary
              classification={classification}
              onBack={goBack}
              onConfirm={handleConfirm}
              submitting={submitting}
            />
          ) : currentQuestion ? (
            <QuestionCard
              question={currentQuestion}
              selectedOptionId={answers[currentQuestion.id] ?? null}
              onSelect={selectOption}
            />
          ) : null}
        </div>
      </div>

      {/* Footer nav (hidden on summary — its own buttons take over) */}
      {!showSummary && (
        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: stepIndex === 0 ? 'var(--text-muted)' : 'var(--text-dim)',
              fontSize: '0.8125rem',
              cursor: stepIndex === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 16px',
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {isLastStep ? 'See summary' : 'Next'} <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ScopingReadOnly — past view ────────────────────────────────────
//
// Shown when the user is browsing scoping (`?phase=scoping`) on a
// project that's already past it. Renders the persisted scope JSON
// + classification as a static card. The Rewind button restarts the
// wizard fresh (cascade-clears everything downstream first).

function ScopingReadOnly({ project, onSelectPhase }: {
  project: StudioProject;
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}) {
  const scope = project.scope ?? {};
  // Filter out helper keys + format snake_case → display label
  const entries = Object.entries(scope)
    .filter(([k]) => k !== 'detected_components')
    .map(([k, v]) => ({ key: k, label: humanizeKey(k), value: formatScopeValue(v) }));
  const detected = (scope as { detected_components?: string[] }).detected_components ?? [];

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Hammer size={14} style={{ color: 'var(--amber)' }} />
          Project scope
        </h2>
        <div style={{ flex: 1 }} />
        <RewindButton projectId={project.id} target="scoping" label="Restart scope" />
      </div>

      <PhaseSidebar project={project} viewedPhase="scoping" onSelect={onSelectPhase} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 16, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              {project.app_level && (
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700,
                  padding: '4px 10px',
                  background: 'var(--amber)', color: '#000',
                  borderRadius: 'var(--radius-full)',
                }}>
                  {project.app_level}
                </span>
              )}
              {project.credits_estimated != null && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  ~{project.credits_estimated} estimated credits
                </span>
              )}
            </div>
            {detected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {detected.map((c) => (
                  <span key={c} style={{
                    fontSize: '0.6875rem', padding: '2px 8px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)', color: 'var(--text)',
                  }}>{c}</span>
                ))}
              </div>
            )}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              fontSize: '0.75rem',
            }}>
              {entries.map((e) => (
                <div key={e.key} style={{
                  padding: '6px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div style={{
                    fontSize: '0.625rem', textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-muted)',
                  }}>
                    {e.label}
                  </div>
                  <div style={{ color: 'var(--text)', marginTop: 2 }}>{e.value}</div>
                </div>
              ))}
            </div>
            {entries.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                No persisted scope data.
              </div>
            )}
          </div>
          <p style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            margin: 0, lineHeight: 1.5, textAlign: 'center',
          }}>
            You are viewing the project's original scope. If you want to redo it,
            use the <strong>"Restart scope"</strong> button — this will clear
            everything generated afterwards.
          </p>
        </div>
      </div>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^needs /, '')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatScopeValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

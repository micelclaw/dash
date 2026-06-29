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

// ─── Studio v3 — Onboarding welcome (§3.1, the warm entry) ──────────
//
// NEVER an empty editor. Three paths for a non-technical user:
//   1. "Cuéntamelo con tus palabras" — free text → creates the project
//      with the system-default model (no model jargon) → lands in scoping.
//   2. Gallery of EXAMPLES (bundled templates) — not blank templates:
//      each pre-fills the flow, editable. Kills the blank-page syndrome.
//   3. "Soy técnico" — the full create modal with the model picker (Pro).
// A skippable 30s tour seeds the mental model. Privacy line up front
// attacks fear #1 (am I going to break/leak something?).

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, Loader2, Lock, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioTemplateMeta } from '@/stores/studio.store';
import { api } from '@/services/api';

interface ModelEntry { id: string; status: string; is_default: boolean }
interface ModelsResponse { models: ModelEntry[]; default_model?: string }

interface Props {
  /** Navigate to the freshly-created project. */
  onCreated: (projectId: string) => void;
  /** Open the technical create modal (model picker, full control). */
  onProMode: () => void;
  /** Shown only when the user already has projects — return to the list. */
  onBack?: () => void;
}

const TOUR_KEY = 'claw-studio-tour-seen';
const TOUR_STEPS = [
  'Cuéntame tu idea con tus palabras — no hace falta que seas técnico.',
  'Yo la construyo paso a paso y la ves tomar forma en directo.',
  'Cuando te guste, la instalas. Y si algo no te convence, vuelves atrás sin romper nada.',
];

// Derive a first project name from the idea — the Concept phase lets the
// user rename it, so a rough first cut is fine.
function deriveName(idea: string): string {
  const first = idea.trim().split('\n')[0]!.trim();
  if (!first) return 'Mi app';
  return first.length > 60 ? first.slice(0, 60).trim() + '…' : first;
}

export function OnboardingWelcome({ onCreated, onProMode, onBack }: Props) {
  const createProject = useStudioStore((s) => s.createProject);
  const fetchTemplates = useStudioStore((s) => s.fetchTemplates);
  const instantiateTemplate = useStudioStore((s) => s.instantiateTemplate);

  const [idea, setIdea] = useState('');
  const [creating, setCreating] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [templates, setTemplates] = useState<StudioTemplateMeta[]>([]);
  const [tourSeen, setTourSeen] = useState(() => {
    try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
  });
  const [tourStep, setTourStep] = useState(0);
  const ideaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then((t) => { if (!cancelled) setTemplates(t.slice(0, 6)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [fetchTemplates]);

  useEffect(() => { ideaRef.current?.focus(); }, []);

  function dismissTour() {
    setTourSeen(true);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode */ }
  }

  async function continueFromIdea() {
    if (!idea.trim() || creating) return;
    setCreating(true);
    try {
      // Auto-pick the system-default model — the guided user never sees
      // a model picker. If none is authed, fall back to the Pro modal
      // (which surfaces the model error properly).
      const res = await api.get<{ data: ModelsResponse }>('/gateway/models');
      const available = (res.data.models ?? []).filter((m) => m.status === 'available');
      const model = (res.data.default_model && available.find((m) => m.id === res.data.default_model))
        ? res.data.default_model
        : available[0]?.id;
      if (!model) {
        toast.message('Primero necesitas configurar un modelo de IA.');
        setCreating(false);
        onProMode();
        return;
      }
      const created = await createProject({ name: deriveName(idea), description: idea.trim(), model });
      onCreated(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pude crear la app');
      setCreating(false);
    }
  }

  async function pickExample(t: StudioTemplateMeta) {
    if (busySlug) return;
    setBusySlug(t.slug);
    try {
      const project = await instantiateTemplate(t.slug);
      onCreated(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pude empezar desde ese ejemplo');
      setBusySlug(null);
    }
  }

  const disabled = creating || busySlug !== null;

  return (
    <div style={wrap}>
      {onBack && (
        <button onClick={onBack} style={backBtn} disabled={disabled}>
          <ChevronLeft size={14} /> Volver a mis apps
        </button>
      )}

      {/* Skippable tour — seeds the mental model (§3.1) */}
      {!tourSeen && (
        <div style={tourStrip}>
          <Sparkles size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.4 }}>
            {TOUR_STEPS[tourStep]}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tourStep + 1}/3</span>
          {tourStep < TOUR_STEPS.length - 1 ? (
            <button onClick={() => setTourStep((s) => s + 1)} style={tourNext}>Siguiente</button>
          ) : (
            <button onClick={dismissTour} style={tourNext}>¡Entendido!</button>
          )}
          <button onClick={dismissTour} style={tourSkip} aria-label="Saltar">
            <X size={13} />
          </button>
        </div>
      )}

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px', textAlign: 'center' }}>
        ¿Qué te gustaría crear hoy?
      </h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 18px', textAlign: 'center' }}>
        Dímelo con tus palabras y yo me encargo del resto.
      </p>

      {/* Path 1 — free text */}
      <div style={ideaCard}>
        <textarea
          ref={ideaRef}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void continueFromIdea(); } }}
          rows={3}
          disabled={disabled}
          placeholder={'Ej.: "quiero que mis clientas pidan cita solas y a mí me avise"'}
          style={ideaInput}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={() => { void continueFromIdea(); }} disabled={!idea.trim() || disabled} style={continueBtn(!idea.trim() || disabled)}>
            {creating ? <><Loader2 size={14} className="animate-spin" /> Preparando…</> : <>Continuar <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* Path 2 — examples (not blank templates: they pre-fill the flow) */}
      {templates.length > 0 && (
        <>
          <div style={divider}><span style={dividerText}>o empieza desde un ejemplo</span></div>
          <div style={exampleGrid}>
            {templates.map((t) => (
              <button key={t.slug} onClick={() => { void pickExample(t); }} disabled={disabled} style={exampleCard(busySlug === t.slug)}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                {busySlug === t.slug && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', color: 'var(--amber)' }}>
                    <Loader2 size={10} className="animate-spin" /> Preparando…
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Privacy + Pro escape hatch */}
      <div style={footerRow}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <Lock size={12} /> Tus datos se quedan en tu sistema.
        </span>
        <button onClick={onProMode} disabled={disabled} style={proLink}>
          Soy técnico, llevo yo las riendas <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 620, margin: '0 auto', padding: '24px 16px',
  display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', position: 'relative',
};
const backBtn: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0,
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px',
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const tourStrip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 18,
  background: 'color-mix(in srgb, var(--amber) 8%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-md)',
};
const tourNext: React.CSSProperties = {
  padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000', border: 'none',
  borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
};
const tourSkip: React.CSSProperties = {
  display: 'flex', padding: 2, background: 'transparent', border: 'none',
  color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
};
const ideaCard: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 14,
};
const ideaInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64,
  padding: '10px 12px', fontSize: '0.9rem', lineHeight: 1.5,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)', outline: 'none',
};
const continueBtn = (off: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', fontSize: '0.85rem', fontWeight: 600,
  background: off ? 'var(--surface)' : 'var(--amber)', color: off ? 'var(--text-muted)' : '#000',
  border: off ? '1px solid var(--border)' : 'none', borderRadius: 'var(--radius-md)',
  cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
});
const divider: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '20px 0 14px', borderTop: '1px solid var(--border)', position: 'relative',
};
const dividerText: React.CSSProperties = {
  position: 'absolute', top: -9, background: 'var(--bg)', padding: '0 10px',
  fontSize: '0.7rem', color: 'var(--text-muted)',
};
const exampleGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10,
};
const exampleCard = (busy: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '14px 8px', textAlign: 'center',
  background: busy ? 'var(--card-hover)' : 'var(--card)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const footerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  marginTop: 22, flexWrap: 'wrap',
};
const proLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: 0, background: 'transparent', border: 'none',
  color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

export default OnboardingWelcome;

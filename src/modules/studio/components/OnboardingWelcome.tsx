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
import { useNavigate } from 'react-router';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioTemplateMeta, type StudioEngineId, type StudioTarget } from '@/stores/studio.store';
import { api } from '@/services/api';
import { EnginePicker } from './EnginePicker';
import { ConnectExternalEngineModal } from './v2/ConnectExternalEngineModal';
import { TourStrip } from './TourStrip';
import { useStudioEngines } from '../hooks/useStudioEngines';
import { TARGET_CARDS } from '../lib/target-cards';


interface Props {
  /** Navigate to the freshly-created project. */
  onCreated: (projectId: string) => void;
  /** Open the technical create modal (model picker, full control). */
  onProMode: () => void;
  /** Shown only when the user already has projects — return to the list. */
  onBack?: () => void;
}

const TOUR_STEPS = [
  'Tell me your idea in your own words — no need to be technical.',
  'I build it step by step and you watch it take shape live.',
  'When you like it, you install it. And if something\'s off, you go back without breaking anything.',
];

// Derive a SHORT first project name from the idea — the Concept phase lets the
// user rename it, so a rough first cut is fine. UX-4: keep it distinct from the
// full idea (which becomes the description) so gallery cards aren't title ==
// subtitle. Cut at the first clause boundary, cap at ~6 words / 42 chars.
function deriveName(idea: string): string {
  const first = idea.trim().split('\n')[0]!.trim();
  if (!first) return 'My app';
  let name = first.split(/\s*[—:.;,]\s+/)[0]!.trim() || first;
  const words = name.split(/\s+/);
  if (words.length > 6) name = words.slice(0, 6).join(' ');
  if (name.length > 42) name = name.slice(0, 42).trim() + '…';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function OnboardingWelcome({ onCreated, onProMode, onBack }: Props) {
  const createProject = useStudioStore((s) => s.createProject);
  const fetchTemplates = useStudioStore((s) => s.fetchTemplates);
  const instantiateTemplate = useStudioStore((s) => s.instantiateTemplate);

  const [idea, setIdea] = useState('');
  const [kind, setKind] = useState<StudioTarget>('micelclaw_app');
  // The engine choice lives behind "Advanced" in Guided — most users
  // should never have to think about it (the default engine just works).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // Set right after a BYO create — opens the MCP connection modal in place.
  const [connectProjectId, setConnectProjectId] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [templates, setTemplates] = useState<StudioTemplateMeta[]>([]);
  const [models, setModels] = useState<Array<{ id: string; label?: string; recommended?: boolean }>>([]);
  const [model, setModel] = useState<string>('');
  const [engine, setEngine] = useState<StudioEngineId>('opencode');
  const engineTouched = useRef(false);
  const { engines, defaultEngine } = useStudioEngines();
  const navigate = useNavigate();
  const ideaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then((t) => { if (!cancelled) setTemplates(t.slice(0, 6)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [fetchTemplates]);

  // Apply the system default engine once it arrives — unless the user
  // already picked one.
  useEffect(() => {
    if (!engineTouched.current && defaultEngine) setEngine(defaultEngine);
  }, [defaultEngine]);

  // OpenCode models load LAZILY — when the built-in engine is the
  // selection (an ACP engine ignores /studio/models entirely) or when
  // the kind is design (its generator runs on the same reachable list).
  useEffect(() => {
    if ((engine !== 'opencode' && kind !== 'design') || models.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ data: { models: Array<{ id: string; label?: string; recommended?: boolean }>; default_model?: string } }>('/studio/models');
        if (cancelled) return;
        const list = res.data.models ?? [];
        setModels(list);
        setModel((prev) => prev || (res.data.default_model ?? list[0]?.id ?? ''));
      } catch { /* fall back to server-side default at create time */ }
    })();
    return () => { cancelled = true; };
  }, [engine, kind, models.length]);

  const selectedEngineInfo = engines.find((e) => e.id === engine);
  // A not-ready ACP engine can be SELECTED (so the choice is visible) but
  // never submitted — the hint below the picker says how to finish setup.
  const engineBlocked = engine !== 'opencode' && selectedEngineInfo ? !selectedEngineInfo.ready : false;

  function changeEngine(next: StudioEngineId) {
    engineTouched.current = true;
    setEngine(next);
    // `model` is engine-scoped: reset when the axis changes.
    if (next === 'opencode') {
      setModel(models.find((m) => m.recommended)?.id ?? models[0]?.id ?? '');
    } else {
      setModel('');
    }
  }

  useEffect(() => { ideaRef.current?.focus(); }, []);

  async function continueFromIdea(opts?: { byo?: boolean }) {
    if (creating) return;
    if (!idea.trim()) {
      // Never a silent no-op on a click — the BYO card is reachable with an
      // empty idea (the Continue button is disabled, the card is not).
      toast.message(opts?.byo
        ? 'Write your idea first — then I create the project and hand you the connection file for your editor.'
        : 'Write your idea first.');
      ideaRef.current?.focus();
      return;
    }
    if (kind !== 'design' && engineBlocked && !opts?.byo) return;
    setCreating(true);
    try {
      // Design-only: no build engine, but the canvas generator DOES run
      // on an LLM — honor an explicit model pick ('' = server resolves
      // the recommended one via ensureDesignProjectModel).
      if (kind === 'design') {
        const created = await createProject({
          name: deriveName(idea),
          description: idea.trim(),
          target: 'design',
          model: model || null,
        });
        onCreated(created.id);
        return;
      }
      // BYO is orthogonal: it always creates with the built-in engine, then
      // the user opens it in their own tool from the build screen.
      const effectiveEngine: StudioEngineId = opts?.byo ? 'opencode' : engine;
      // OpenCode (built-in) needs a model; ACP engines carry a curated
      // alias/id ('' = harness default → null).
      let chosen = effectiveEngine === 'opencode'
        ? (engine === 'opencode' ? model : '')
        : (model.trim() || null);
      if (effectiveEngine === 'opencode' && !chosen) {
        try {
          const res = await api.get<{ data: { models: Array<{ id: string }>; default_model?: string } }>('/studio/models');
          chosen = res.data.default_model ?? res.data.models?.[0]?.id ?? '';
        } catch { /* ignore */ }
      }
      if (effectiveEngine === 'opencode' && !chosen) {
        toast.message('You need to set up an AI model first.');
        setCreating(false);
        onProMode();
        return;
      }
      const created = await createProject({
        name: deriveName(idea),
        description: idea.trim(),
        model: chosen || null,
        engine: effectiveEngine,
        target: kind === 'micelclaw_app' ? undefined : kind,
      });
      if (opts?.byo) {
        // BYO handoff happens RIGHT HERE: open the connection modal with the
        // .mcp.json + bearer; navigating to the project happens on close.
        setCreating(false);
        setConnectProjectId(created.id);
        return;
      }
      onCreated(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t create the app');
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
      toast.error(err instanceof Error ? err.message : 'Couldn\'t start from that example');
      setBusySlug(null);
    }
  }

  const disabled = creating || busySlug !== null;

  return (
    <div style={wrap}>
      {onBack && (
        <button onClick={onBack} style={backBtn} disabled={disabled}>
          <ChevronLeft size={14} /> Back to my apps
        </button>
      )}

      {/* Skippable tour — seeds the mental model (§3.1) */}
      <TourStrip storageKey="claw-studio-tour-seen" steps={TOUR_STEPS} />

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px', textAlign: 'center' }}>
        What would you like to build today?
      </h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 18px', textAlign: 'center' }}>
        Tell me in your own words and I'll handle the rest.
      </p>

      {/* What are we making? — the target axis as BIG self-explanatory
          cards (icon + description + concrete example), not tiny chips.
          Shared copy with the Pro modal via TARGET_CARDS. */}
      <div style={kindGrid}>
        {TARGET_CARDS.map((k) => {
          const active = kind === k.id;
          const Icon = k.icon;
          return (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} disabled={disabled} style={kindCard(active)}>
              <Icon size={20} style={{ color: active ? 'var(--amber)' : 'var(--text-dim)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{k.title}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.45 }}>{k.desc}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'auto' }}>
                e.g. “{k.example}”
              </span>
            </button>
          );
        })}
      </div>

      {/* Path 1 — free text */}
      <div style={ideaCard}>
        <textarea
          ref={ideaRef}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void continueFromIdea(); } }}
          rows={3}
          disabled={disabled}
          placeholder={
            kind === 'design' ? 'E.g.: "A landing page for my dog-grooming studio, with prices and a booking form"'
              : kind === 'website' ? 'E.g.: "A site for my bakery: home, products with prices, where to find us"'
                : kind === 'webapp' ? 'E.g.: "A workout tracker that keeps everything in the browser"'
                  : kind === 'mobile' ? 'E.g.: "A shopping-list app I can install on my phone"'
                    : 'E.g.: "I want my clients to book their own appointments and notify me"'
          }
          style={ideaInput}
        />
        {kind === 'design' && (
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            You'll get three visual directions to pick from, then refine the screens on a canvas.
            No build engine involved — but you can pick the AI model under Advanced.
          </p>
        )}
        {/* Engine chooser — folded behind "Advanced" in Guided: the
            important decision here is the idea, not the engine. The
            summary always shows the active choice (amber when it needs
            setup). Design-only projects have no build engine, but their
            canvas generator runs on an LLM → model-only picker. */}
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)} disabled={disabled} style={advancedToggle}>
            {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span style={{ fontWeight: 600 }}>{kind === 'design' ? 'Advanced — AI model' : 'Advanced — engine & model'}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: engineBlocked ? 'var(--amber)' : 'var(--text-muted)' }}>
              {kind === 'design'
                ? (model ? model.split('/').pop() : 'Automatic (recommended)')
                : (selectedEngineInfo?.label ?? 'Built-in')
                  + (engine === 'opencode' && model ? ` · ${model.split('/').pop()}` : '')
                  + (engineBlocked ? ' — needs setup' : '')}
            </span>
          </button>
          {advancedOpen && (kind === 'design' ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-dim)' }}>
                AI model for the design generation
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={disabled}
                style={modelSelect}
              >
                <option value="">Automatic (recommended)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label ?? m.id}{m.recommended ? ' ★' : ''}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Only models the generator can actually reach are listed (from Models › Configured).
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <EnginePicker
                engines={engines}
                engine={engine}
                onEngineChange={changeEngine}
                model={model}
                onModelChange={setModel}
                models={models}
                onConfigureEngine={(id) => navigate(`/settings/studio-engines${id ? `?focus=${id}` : ''}`)}
                onChooseByo={() => { void continueFromIdea({ byo: true }); }}
                disabled={disabled}
              />
            </div>
          ))}
        </div>

        {kind !== 'design' && engineBlocked && (
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'var(--amber)', lineHeight: 1.4 }}>
            Finish setup to use {selectedEngineInfo?.label ?? 'this engine'} — or pick Built-in to start now.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={() => { void continueFromIdea(); }} disabled={!idea.trim() || disabled || (kind !== 'design' && engineBlocked)} style={continueBtn(!idea.trim() || disabled || (kind !== 'design' && engineBlocked))}>
            {creating ? <><Loader2 size={14} className="animate-spin" /> Preparing…</> : <>Continue <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* Path 2 — examples (not blank templates: they pre-fill the flow) */}
      {templates.length > 0 && (
        <>
          <div style={divider}><span style={dividerText}>or start from an example</span></div>
          <div style={exampleGrid}>
            {templates.map((t) => (
              <button key={t.slug} onClick={() => { void pickExample(t); }} disabled={disabled} style={exampleCard(busySlug === t.slug)}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                {busySlug === t.slug && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', color: 'var(--amber)' }}>
                    <Loader2 size={10} className="animate-spin" /> Preparing…
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* BYO handoff — the connection modal opens right after the create. */}
      {connectProjectId && (
        <ConnectExternalEngineModal
          projectId={connectProjectId}
          onClose={() => {
            const id = connectProjectId;
            setConnectProjectId(null);
            onCreated(id);
          }}
        />
      )}

      {/* Privacy + Pro escape hatch */}
      <div style={footerRow}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <Lock size={12} /> Your data stays on your system.
        </span>
        <button onClick={onProMode} disabled={disabled} style={proLink}>
          I'm technical, let me drive <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 680, margin: '0 auto', padding: '24px 16px',
  display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', position: 'relative',
};
const kindGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
  gap: 10, marginBottom: 14,
};
const kindCard = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
  padding: '13px 14px', textAlign: 'left', minHeight: 118,
  background: active ? 'color-mix(in srgb, var(--amber) 8%, var(--card))' : 'var(--card)',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const advancedToggle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  padding: '8px 10px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const modelSelect: React.CSSProperties = {
  padding: '6px 10px', fontSize: '0.8rem', width: '100%', maxWidth: 340,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)',
};
const backBtn: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0,
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px',
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
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

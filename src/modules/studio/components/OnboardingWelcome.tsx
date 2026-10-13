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

// ─── Studio — the single creation surface (unified funnel, ADR-18) ──
//
// MERGED create+compose (user request 2026-07-21): the old create screen
// only collected an idea and then showed a second, near-identical screen
// (the intake compose) — pointless hop. Now ONE screen collects idea +
// Layout (structural template) + Style (design system) + instant preview,
// and Continue creates the project, persists those choices into the
// intake draft, and lands DIRECTLY on the questions step. The compose
// step still exists inside the workbench (Back from questions) for
// re-editing layout/style.
//
// Examples are a curated in-dash list (the old studio_templates gallery
// no longer instantiates anything): compact cards that PRE-FILL the idea
// with a detailed description — same funnel, zero divergent paths.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioEngineId } from '@/stores/studio.store';
import { api } from '@/services/api';
import { EnginePicker } from './EnginePicker';
import { ConnectExternalEngineModal } from './v2/ConnectExternalEngineModal';
import { TourStrip } from './TourStrip';
import { DesignSystemPicker } from './DesignSystemPicker';
import { DesignSystemGalleryModal } from './DesignSystemGalleryModal';
import { useStudioEngines } from '../hooks/useStudioEngines';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fetchDesignTemplates, updateIntake, type DesignTemplateMeta } from '../design/design.service';
import { templateIcon } from '../design/template-icons';
import { InstantPreview } from '../design/InstantPreview';

interface Props {
  /** Navigate to the freshly-created project. */
  onCreated: (projectId: string) => void;
  /** Shown only when the user already has projects — return to the list. */
  onBack?: () => void;
}

const TOUR_STEPS = [
  'Tell me your idea in your own words — no need to be technical.',
  'I ask a few quick questions, show you the look, and build it step by step.',
  'Nothing goes live until you say so — and you can always step back.',
];

// Curated examples — compact cards that PRE-FILL the idea with a detailed
// description (rich enough to feed the questionnaire something real).
const EXAMPLES: Array<{ icon: string; name: string; idea: string }> = [
  { icon: '📇', name: 'Personal CRM', idea: 'A personal CRM to keep track of the people I meet: name, company, where we met, notes from every conversation, and a reminder to follow up when too much time passes.' },
  { icon: '✅', name: 'Habit tracker', idea: 'A habit tracker where I define daily and weekly habits, tick them off each day, and see streaks and a monthly consistency chart to stay motivated.' },
  { icon: '💿', name: 'Vinyl collection', idea: 'A catalog for my vinyl collection: album, artist, year, condition, and estimated value — with search, filters by genre, and a wishlist of records I still want.' },
  { icon: '📦', name: 'Simple inventory', idea: 'A simple home inventory: what I own, where it is stored, purchase date and price, with photos, locations, and alerts for warranties about to expire.' },
  { icon: '📖', name: 'Reading diary', idea: 'A reading diary where I log the books I read, my rating, favorite quotes and a short review — plus a shelf of pending books and yearly reading stats.' },
  { icon: '⛅', name: 'Weather skill', idea: 'Teach my AI assistant to look up the weather for any city using a public API, so I can ask it in chat and get the forecast without opening anything.' },
  { icon: '🌱', name: 'Plant waterer', idea: 'An app to care for my plants: each plant with its photo, location and watering schedule, reminders when watering is due, and a log of when I last fed or repotted them.' },
  { icon: '💶', name: 'Expense splitter', idea: 'An expense splitter for trips with friends: everyone adds what they paid, the app works out who owes whom, and we settle up with the fewest transfers.' },
  { icon: '🍲', name: 'Recipe box', idea: 'A recipe box for my family recipes: ingredients, steps and photos, tagged by occasion, with a weekly meal plan and an auto-generated shopping list.' },
  { icon: '🏋️', name: 'Workout log', idea: 'A workout log where I record exercises, sets, reps and weight per session, and see progress charts per exercise over time.' },
  { icon: '🧹', name: 'Family chores', idea: 'A chore board for my family: recurring tasks assigned to each member, points when completed, and a weekly summary of who did what.' },
  { icon: '🔧', name: 'Home maintenance', idea: 'A home maintenance log: appliances and installations with their manuals, service dates and costs, plus automatic reminders for periodic checks like the boiler or smoke alarms.' },
];

// Derive a SHORT first project name from the idea — renameable later on the
// agreement card and in the project header. UX-4: keep it distinct from the
// full idea (which becomes the description) so gallery cards aren't title ==
// subtitle. Cut at the first clause boundary, cap at ~6 words / 42 chars.
function deriveName(idea: string): string {
  const first = idea.trim().split('\n')[0]!.trim();
  if (!first) return 'My project';
  let name = first.split(/\s*[—:.;,]\s+/)[0]!.trim() || first;
  const words = name.split(/\s+/);
  if (words.length > 6) name = words.slice(0, 6).join(' ');
  if (name.length > 42) name = name.slice(0, 42).trim() + '…';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function OnboardingWelcome({ onCreated, onBack }: Props) {
  const createProject = useStudioStore((s) => s.createProject);
  const refetchProject = useStudioStore((s) => s.refetchProject);

  const [idea, setIdea] = useState('');
  // The two composer axes (merged from the intake compose step): Layout
  // (structural template) × Style (design system).
  const [dTemplates, setDTemplates] = useState<DesignTemplateMeta[]>([]);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [designSystemSlug, setDesignSystemSlug] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  // Technical knobs live behind "Advanced" — most users never open it.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [nameOverride, setNameOverride] = useState('');
  const [creating, setCreating] = useState(false);
  // Set right after a BYO create — opens the MCP connection modal in place.
  const [connectProjectId, setConnectProjectId] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string; label?: string; recommended?: boolean }>>([]);
  const [model, setModel] = useState<string>('');
  const [engine, setEngine] = useState<StudioEngineId>('opencode');
  const engineTouched = useRef(false);
  const { engines, defaultEngine } = useStudioEngines();
  const navigate = useNavigate();
  const ideaRef = useRef<HTMLTextAreaElement | null>(null);
  // Desktop uses the WIDTH: form on the left, a big sticky preview on the
  // right. Mobile/tablet keep the single centered column.
  const wide = useMediaQuery('(min-width: 1180px)');

  useEffect(() => {
    let cancelled = false;
    fetchDesignTemplates().then((t) => { if (!cancelled) setDTemplates(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Apply the system default engine once it arrives — unless the user
  // already picked one.
  useEffect(() => {
    if (!engineTouched.current && defaultEngine) setEngine(defaultEngine);
  }, [defaultEngine]);

  // Models load lazily, only when Advanced is open with the built-in engine
  // (the server resolves a model on its own otherwise).
  useEffect(() => {
    if (!advancedOpen || engine !== 'opencode' || models.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ data: { models: Array<{ id: string; label?: string; recommended?: boolean }>; default_model?: string } }>('/studio/models');
        if (cancelled) return;
        const list = res.data.models ?? [];
        setModels(list);
        setModel((prev) => prev || (res.data.default_model ?? list[0]?.id ?? ''));
      } catch { /* fall back to the server-side default at create time */ }
    })();
    return () => { cancelled = true; };
  }, [advancedOpen, engine, models.length]);

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

  function pickTemplate(slug: string) {
    setTemplateSlug((cur) => {
      const next = cur === slug ? null : slug;
      // First-party pairing: the Micelclaw Module layout auto-selects the
      // OS style (without clobbering an explicit prior choice).
      if (next === 'micelclaw-module') setDesignSystemSlug((s) => s ?? 'micelclaw-os');
      return next;
    });
  }

  useEffect(() => { ideaRef.current?.focus(); }, []);

  async function continueFromIdea(opts?: { byo?: boolean }) {
    if (creating) return;
    if (!idea.trim()) {
      // Never a silent no-op on a click — the BYO entry is reachable with an
      // empty idea (the Continue button is disabled, the picker card is not).
      toast.message(opts?.byo
        ? 'Write your idea first — then I create the project and hand you the connection file for your editor.'
        : 'Write your idea first.');
      ideaRef.current?.focus();
      return;
    }
    if (engineBlocked && !opts?.byo) return;
    setCreating(true);
    try {
      // ONE create path (ADR-18): born pre-target; the layout/style chosen
      // HERE persist into the intake draft and the project lands directly
      // on the questions step (this screen IS the compose).
      const created = await createProject({
        name: (nameOverride.trim() || deriveName(idea)).slice(0, 100),
        description: idea.trim(),
        model: model || null,
        engine: opts?.byo ? 'opencode' : engine,
      });
      await updateIntake(created.id, {
        step: 'questions',
        template: templateSlug,
        design_system: designSystemSlug,
        description: idea.trim(),
      }).catch(() => { /* draft is best-effort; the workbench recovers */ });
      // Refresh the store row BEFORE navigating: the workbench initializes
      // its intake step from project.design_brief — without this it would
      // mount on the stale create response (empty brief) and land the user
      // back on compose, resurrecting the screen this merge removed.
      await refetchProject(created.id).catch(() => {});
      if (opts?.byo) {
        // BYO handoff happens RIGHT HERE: open the connection modal with the
        // .mcp.json + bearer; navigating to the project happens on close.
        setCreating(false);
        setConnectProjectId(created.id);
        return;
      }
      onCreated(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t create the project');
      setCreating(false);
    }
  }

  const disabled = creating;

  return (
    <div style={wrap(wide)}>
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
        Describe it, pick a starting point if you like — I'll ask a few quick questions next.
      </p>

      <div style={wide ? twoCol : undefined}>
      <div style={ideaCard}>
        <textarea
          ref={ideaRef}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void continueFromIdea(); } }}
          rows={3}
          disabled={disabled}
          placeholder='E.g.: "I want my clients to book their own appointments and get a reminder"'
          style={ideaInput}
        />

        {/* Layout axis — structural templates (merged from the compose step) */}
        {dTemplates.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={axisLabel}>Start with a template…</div>
            <div style={templateGrid}>
              {dTemplates.map((t) => {
                const active = templateSlug === t.slug;
                const Icon = templateIcon(t.slug);
                return (
                  <button key={t.slug} type="button" onClick={() => pickTemplate(t.slug)} disabled={disabled} style={templateCard(active)} title={t.description}>
                    <Icon size={15} style={{ color: active ? 'var(--amber)' : 'var(--text-dim)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Style axis — design system (optional) */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={axisLabel}>Design system <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — a known visual language as base)</span></div>
            <button type="button" onClick={() => setShowGallery(true)} disabled={disabled} style={browseAllBtn}>Browse all →</button>
          </div>
          <DesignSystemPicker
            value={designSystemSlug}
            onSelect={(slug) => setDesignSystemSlug(slug)}
            disabled={disabled}
            compact
            hidePreview
          />
        </div>

        {/* Instant preview inline only on narrow screens (desktop gets
            the dedicated right column below) */}
        {!wide && (templateSlug || designSystemSlug) && (
          <div style={{ marginTop: 12 }}>
            <div style={axisLabel}>
              Preview <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {templateSlug ? 'this template, themed by your design system' : 'your design system'} (the directions personalize the content)</span>
            </div>
            <InstantPreview templateSlug={templateSlug} designSystemSlug={designSystemSlug} height={300} />
          </div>
        )}

        {/* Technical knobs, folded: engine/model only matter at build time
            and stay editable later (Build settings). */}
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)} disabled={disabled} style={advancedToggle}>
            {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span style={{ fontWeight: 600 }}>Advanced — name, engine & model</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: engineBlocked ? 'var(--amber)' : 'var(--text-muted)' }}>
              {(selectedEngineInfo?.label ?? 'Built-in')
                + (engine === 'opencode' && model ? ` · ${model.split('/').pop()}` : '')
                + (engineBlocked ? ' — needs setup' : '')}
            </span>
          </button>
          {advancedOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-dim)' }}>
                  Project name (optional — derived from the idea if empty)
                </label>
                <input
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  disabled={disabled}
                  maxLength={100}
                  placeholder={idea.trim() ? deriveName(idea) : 'My project'}
                  style={nameInput}
                />
              </div>
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
          )}
        </div>

        {engineBlocked && (
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'var(--amber)', lineHeight: 1.4 }}>
            Finish setup to use {selectedEngineInfo?.label ?? 'this engine'} — or pick Built-in to start now.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={() => { void continueFromIdea(); }} disabled={!idea.trim() || disabled || engineBlocked} style={continueBtn(!idea.trim() || disabled || engineBlocked)}>
            {creating ? <><Loader2 size={14} className="animate-spin" /> Preparing…</> : <>Continue <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* Desktop: the preview owns the right half — big and sticky */}
      {wide && (
        <div style={previewCol}>
          <div style={axisLabel}>
            Preview <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {templateSlug ? 'this template, themed by your design system' : designSystemSlug ? 'your design system' : 'pick a template or a style to see it here'} {templateSlug ? '(the directions personalize the content)' : ''}</span>
          </div>
          {(templateSlug || designSystemSlug) ? (
            <InstantPreview templateSlug={templateSlug} designSystemSlug={designSystemSlug} height="calc(100vh - 300px)" />
          ) : (
            <div style={previewPlaceholder}>
              The live preview appears here —<br />pick a template or a design system on the left.
            </div>
          )}
        </div>
      )}
      </div>

      {/* Examples — compact cards that pre-fill the idea (editable) */}
      <div style={divider}><span style={dividerText}>or start from an example</span></div>
      <div style={exampleGrid}>
        {EXAMPLES.map((ex) => (
          <button key={ex.name} onClick={() => { setIdea(ex.idea); ideaRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={disabled} style={exampleCard} title={ex.idea}>
            <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{ex.icon}</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.15 }}>{ex.name}</span>
          </button>
        ))}
      </div>

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

      {showGallery && (
        <DesignSystemGalleryModal
          value={designSystemSlug}
          onSelect={(slug) => { setDesignSystemSlug(slug); setShowGallery(false); }}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* Privacy line */}
      <div style={footerRow}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <Lock size={12} /> Your data stays on your system.
        </span>
      </div>
    </div>
  );
}

const wrap = (wide: boolean): React.CSSProperties => ({
  maxWidth: wide ? 1500 : 680, width: '100%', boxSizing: 'border-box',
  margin: '0 auto', padding: wide ? '24px 32px' : '24px 16px',
  display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', position: 'relative',
});
// Desktop split: the form keeps a readable column; the preview takes the
// REST of the width (sticky, tall) instead of a letterboxed strip.
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(440px, 560px) 1fr',
  gap: 20, alignItems: 'start',
};
const previewCol: React.CSSProperties = {
  position: 'sticky', top: 12,
};
const previewPlaceholder: React.CSSProperties = {
  border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
  minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: 24,
};
const axisLabel: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8,
};
const templateGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8,
};
const templateCard = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
  padding: '9px 6px', textAlign: 'center',
  background: active ? 'color-mix(in srgb, var(--amber) 8%, var(--card))' : 'var(--card)',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const browseAllBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: '0.72rem', fontWeight: 600, color: 'var(--amber)', fontFamily: 'var(--font-sans)',
};
const advancedToggle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  padding: '8px 10px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const nameInput: React.CSSProperties = {
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
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8,
};
const exampleCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: '9px 6px', textAlign: 'center',
  background: 'var(--card)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const footerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  marginTop: 22, flexWrap: 'wrap',
};

export default OnboardingWelcome;

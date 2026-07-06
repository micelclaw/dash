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

// ─── Design workbench — the Claude-Design-style canvas experience ────
//
// The SAME canvas serves two surfaces (convergence, ADR-17 amendment):
//   · target='design' projects (DesignStudioPage thin wrapper, no phase
//     rail, full chrome: Export / Publish / "Build this app"), and
//   · the Frontend phase of ANY project (FrontendPhase embeds it with
//     chrome='frontend-phase': the phase panel owns Approve; export/
//     publish/convert hidden — the output is the derived doc + build).
// Flow:
//   1. Intro: describe → pick feel/colors → Generate (3 variants, A/B/C).
//   2. Variant picker: view each, "Use this design" pins it (+ design.md).
//   3. Canvas: pages rail (+ one-click screen suggestions from the
//      concept) · sandboxed canvas with element selection · instruction
//      bar (edit-with-AI, scoped, optional apply-across-pages) · inline
//      text edit (no LLM) · brand color knobs · history · actions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft, Loader2, Sparkles, Plus, Trash2, Monitor, Smartphone,
  Type, Wand2, History, Palette, X, Check, ArrowRight, Hammer, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StudioProject } from '@/stores/studio.store';
import { defaultTokensFromFeel } from '../lib/mockups';
import { useConfirm } from '../lib/useConfirm';
import { ConnectExternalEngineModal } from '../components/v2/ConnectExternalEngineModal';
import {
  listDesignPages, generateInitialVariants, selectDesignVariant,
  createDesignPage, editDesignPage, saveDeterministicVersion,
  listDesignVersions, revertDesignVersion, deleteDesignPage,
  updateDesignTokens, fetchProjectTokensCss, continueBuildInStudio,
  patchElementText, listUserDomains, getProjectSite, publishProjectSite,
  unpublishSite, fetchScreenSuggestions,
  type DesignPage, type SystemDomainOption, type PublishedSiteInfo,
} from './design.service';
import { DesignCanvas, type CanvasSelection, type DesignCanvasHandle } from './DesignCanvas';
import { useStudioStreamsStore } from '../streams/studio-generation-streams';

export interface DesignWorkbenchProps {
  project: StudioProject;
  onExit: () => void;
  /** Refetch the project (after continue-build converts it). */
  onProjectChanged?: () => void;
  /** 'design' (default): full chrome. 'frontend-phase': embedded in the
   *  Frontend phase — no Back/Export/Publish/convert; the parent injects
   *  its own `actions` (Approve frontend, View spec). */
  chrome?: 'design' | 'frontend-phase';
  /** Extra top-bar actions injected by the embedding phase. */
  actions?: React.ReactNode;
  /** Fires whenever the page set changes — lets the embedding phase know
   *  whether a direction is picked (enables its Approve). */
  onPagesChanged?: (pages: DesignPage[]) => void;
}

const FEELS = [
  { id: 'elegant', label: 'Elegant' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'warm', label: 'Warm' },
  { id: 'minimal', label: 'Minimal' },
] as const;

// One-click iteration starters for the frontend phase — the instruction
// bar absorbs the old "Iterate on the document" panel (B7).
const CANVAS_SUGGESTIONS = [
  'Make it more minimal',
  'Try a darker palette',
  'Bigger, bolder typography',
  'More whitespace between sections',
];

/** Thin wrapper kept for target='design' projects (full chrome). */
export function DesignStudioPage(props: Omit<DesignWorkbenchProps, 'chrome' | 'actions' | 'onPagesChanged'>) {
  return <DesignWorkbench {...props} chrome="design" />;
}

export function DesignWorkbench({ project, onExit, onProjectChanged, chrome = 'design', actions, onPagesChanged }: DesignWorkbenchProps) {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();
  const canvasRef = useRef<DesignCanvasHandle | null>(null);

  const [pages, setPages] = useState<DesignPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokensCss, setTokensCss] = useState<string | null>(null);
  const [designMds, setDesignMds] = useState<Record<string, string | null>>({});

  // Intro state
  const [prompt, setPrompt] = useState(project.description ?? '');
  const [feel, setFeel] = useState<string>('minimal');
  const [brandColors, setBrandColors] = useState('');
  const [generating, setGenerating] = useState(false);

  // Live generation progress: the 3 directions generate SEQUENTIALLY and
  // each streams `studio.generation.*` events (phase design_page) into the
  // global streams store — surface them so the skeleton never looks frozen.
  const genStream = useStudioStreamsStore((s) => s.streams[`${project.id}:design_page`]);
  const [doneDirections, setDoneDirections] = useState(0);
  const prevGenStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const st = genStream?.status;
    if (generating && st === 'done' && prevGenStatus.current !== 'done') {
      setDoneDirections((n) => Math.min(3, n + 1));
    }
    prevGenStatus.current = st;
  }, [genStream?.status, generating]);

  // Canvas state
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const [instruction, setInstruction] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [showKnobs, setShowKnobs] = useState(false);
  const [knobColors, setKnobColors] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Array<{ version: number; source: string; instruction: string | null; created_at: string }>>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [domains, setDomains] = useState<SystemDomainOption[]>([]);
  const [publishDomainId, setPublishDomainId] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [site, setSite] = useState<PublishedSiteInfo | null>(null);
  const [publishing, setPublishing] = useState(false);

  const designChrome = chrome === 'design';
  const [screenSuggestions, setScreenSuggestions] = useState<string[]>([]);

  const variants = pages.filter((p) => p.variant_group === 'initial');
  const realPages = useMemo(() => pages.filter((p) => !p.variant_group), [pages]);
  const activePage = realPages.find((p) => p.id === activePageId)
    ?? variants.find((p) => p.id === activePageId)
    ?? realPages[0] ?? variants[0] ?? null;

  const effectiveTokens = tokensCss ?? defaultTokensFromFeel(feel);

  // Let the embedding phase track the picked/unpicked state (Approve gate).
  useEffect(() => { onPagesChanged?.(pages); }, [pages, onPagesChanged]);

  // Frontend phase: one-click screen suggestions scanned from the concept.
  useEffect(() => {
    if (designChrome) return;
    let cancelled = false;
    fetchScreenSuggestions(project.id)
      .then((s) => { if (!cancelled) setScreenSuggestions(s); })
      .catch(() => { /* suggestions are sugar, never an error */ });
    return () => { cancelled = true; };
  }, [designChrome, project.id, realPages.length]);

  const refresh = useCallback(async () => {
    const res = await listDesignPages(project.id);
    setPages(res.pages);
    const css = await fetchProjectTokensCss(project.id);
    setTokensCss(css);
    return res;
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load the design');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // Seed knob colors from the tokens css when it changes.
  useEffect(() => {
    const css = effectiveTokens ?? '';
    const grab = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css)?.[1];
    setKnobColors({
      primary: grab('primary') ?? '#6366f1',
      accent: grab('accent') ?? '#f59e0b',
      background: grab('background') ?? '#ffffff',
    });
  }, [effectiveTokens]);

  const overridesCss = useMemo(() => {
    const entries = Object.entries(knobColors)
      .map(([k, v]) => `--color-${k}: ${v};`).join(' ');
    return entries ? `:root { ${entries} }` : '';
  }, [knobColors]);

  // ─── Actions ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setDoneDirections(0);
    try {
      const res = await generateInitialVariants(project.id, {
        prompt: prompt.trim(),
        feel,
        brand_colors: brandColors.trim() || undefined,
        design_system: project.design_system ?? undefined,
      });
      setPages(res.pages);
      const map: Record<string, string | null> = {};
      for (const d of res.design_mds) if (d.page_id) map[d.page_id] = d.design_md;
      setDesignMds(map);
      const first = res.pages.find((p) => p.variant_group === 'initial');
      if (first) setActivePageId(first.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePickVariant(page: DesignPage) {
    setBusyAction('pick');
    try {
      const updated = await selectDesignVariant(project.id, page.id, designMds[page.id] ?? null);
      setPages(updated);
      setActivePageId(updated.find((p) => !p.variant_group)?.id ?? null);
      const css = await fetchProjectTokensCss(project.id);
      setTokensCss(css);
      toast.success('Design direction pinned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pick the variant');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEditWithAI() {
    if (!activePage || !instruction.trim() || editing) return;
    setEditing(true);
    try {
      const res = await editDesignPage(project.id, activePage.id, {
        instruction: instruction.trim(),
        element: selection ? {
          claw_id: selection.claw_id, tag: selection.tag,
          path: selection.path, outer_html: selection.outer_html,
        } : undefined,
        apply_all: applyAll && realPages.length > 1,
      });
      setPages(res.pages);
      setInstruction('');
      setSelection(null);
      canvasRef.current?.clearSelection();
      toast.success(applyAll && res.applied.length > 1 ? `Applied across ${res.applied.length} pages` : 'Page updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditing(false);
    }
  }

  const handleTextEdited = useCallback((clawId: number, newText: string) => {
    void (async () => {
      const page = pages.filter((p) => !p.variant_group).find((p) => p.id === activePageId) ?? pages.find((p) => !p.variant_group);
      if (!page) return;
      const patched = patchElementText(page.html, clawId, newText);
      if (!patched) { toast.error("Couldn't apply the text change"); return; }
      try {
        await saveDeterministicVersion(project.id, page.id, patched, selection ? {
          claw_id: clawId, tag: selection.tag, path: selection.path, outer_html: '',
        } : null);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save the text change');
      }
    })();
  }, [pages, activePageId, project.id, selection, refresh]);

  async function addPageNamed(name: string) {
    setAddingPage(true);
    try {
      const res = await createDesignPage(project.id, name);
      setPages(res.pages);
      setActivePageId(res.page_id);
      if (res.fallback) toast.message('The engine struggled with that screen — a placeholder was added, try editing it.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add the screen');
    } finally {
      setAddingPage(false);
    }
  }

  async function handleAddPage() {
    const name = window.prompt('Name of the new screen (e.g. "Pricing", "Settings"):')?.trim();
    if (!name) return;
    await addPageNamed(name);
  }

  async function handleDeletePage(page: DesignPage) {
    const ok = await confirm({
      title: `Delete "${page.name}"?`,
      body: 'The screen and its history will be removed from the design.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await deleteDesignPage(project.id, page.id);
      setPages(updated);
      if (activePageId === page.id) setActivePageId(updated.find((p) => !p.variant_group)?.id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleSaveKnobs() {
    setBusyAction('knobs');
    try {
      await updateDesignTokens(project.id, knobColors);
      const css = await fetchProjectTokensCss(project.id);
      setTokensCss(css);
      toast.success('Brand colors saved — they apply to every page');
      setShowKnobs(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save colors');
    } finally {
      setBusyAction(null);
    }
  }

  async function openHistory() {
    if (!activePage) return;
    setShowHistory(true);
    try {
      setVersions(await listDesignVersions(project.id, activePage.id));
    } catch { /* toast on revert instead */ }
  }

  async function handleRevert(version: number) {
    if (!activePage) return;
    try {
      await revertDesignVersion(project.id, activePage.id, version);
      await refresh();
      setShowHistory(false);
      toast.success(`Back to version ${version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed');
    }
  }

  async function openPublish() {
    setShowPublish(true);
    setShowExport(false);
    try {
      const [doms, existing] = await Promise.all([listUserDomains(), getProjectSite(project.id)]);
      setDomains(doms);
      setSite(existing);
      if (existing) {
        setPublishSlug(existing.host.split('.')[0] ?? '');
      } else if (!publishSlug) {
        setPublishSlug(project.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'my-site');
      }
      const primary = doms.find((d) => d.is_primary) ?? doms[0];
      if (primary) setPublishDomainId((cur) => cur || primary.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load your domains');
    }
  }

  async function handlePublish() {
    if (!publishDomainId || !publishSlug.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await publishProjectSite(project.id, {
        system_domain_id: publishDomainId,
        subdomain: publishSlug.trim(),
      });
      setSite({ id: res.id, host: res.host, status: 'published', current_release: res.release });
      toast.success(`Live at ${res.url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!site) return;
    const ok = await confirm({
      title: `Take ${site.host} offline?`,
      body: 'The address stops serving the site. Your design and its releases are kept — you can publish again anytime.',
      confirmLabel: 'Unpublish',
      danger: true,
    });
    if (!ok) return;
    try {
      await unpublishSite(site.id);
      setSite(null);
      toast.success('Site unpublished');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unpublish failed');
    }
  }

  async function handleContinueBuild() {
    const ok = await confirm({
      title: 'Continue building this in Studio?',
      body: 'Your design gets pinned and the project becomes a buildable app — you\'ll go through a quick scoping and the Builder implements these screens for real.',
      confirmLabel: 'Continue in Studio',
    });
    if (!ok) return;
    setBusyAction('continue');
    try {
      await continueBuildInStudio(project.id);
      toast.success('Design pinned — let\'s build it');
      onProjectChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setBusyAction(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={16} className="spin" /> Loading your design…
      </div>
    );
  }

  // 1 — Intro (no pages yet)
  if (pages.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px', fontFamily: 'var(--font-sans)' }}>
        {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back to my apps</button>}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 4px' }}>
          {designChrome ? 'What are we designing?' : "Let's design your screens"}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 16px' }}>
          {designChrome
            ? "Describe it and I'll propose three visual directions. You pick one and refine it on the canvas."
            : "I'll propose three visual directions based on what we agreed in the concept. You pick one and refine every screen on the canvas."}
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={generating}
          placeholder={'E.g.: "A landing page for my dog-grooming studio, with prices and a booking form"'}
          style={textArea}
        />
        <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
          {FEELS.map((f) => (
            <button key={f.id} onClick={() => setFeel(f.id)} disabled={generating} style={chip(feel === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={brandColors}
          onChange={(e) => setBrandColors(e.target.value)}
          disabled={generating}
          placeholder='Brand colors (optional): "deep green and cream", #16a34a…'
          style={{ ...textArea, minHeight: 0, height: 38, resize: 'none' as const }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={() => { void handleGenerate(); }} disabled={!prompt.trim() || generating} style={primaryBtn(!prompt.trim() || generating)}>
            {generating
              ? <><Loader2 size={14} className="spin" /> Designing 3 directions… usually 1–2 min</>
              : <><Sparkles size={14} /> {designChrome ? 'Design it' : 'Explore 3 directions'}</>}
          </button>
        </div>
        {generating && (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {(['A', 'B', 'C'] as const).map((l, i) => {
              const isDone = i < doneDirections;
              const isActive = i === doneDirections;
              const chars = isActive ? (genStream?.text?.length ?? 0) : 0;
              const thinking = isActive && chars === 0 && (genStream?.reasoning?.length ?? 0) > 0;
              return (
                <div
                  key={l}
                  style={{
                    height: 160, borderRadius: 8,
                    border: `1px solid ${isDone ? '#22c55e' : isActive ? 'var(--amber)' : 'var(--border)'}`,
                    background: 'var(--card)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: '0.8rem',
                  }}
                >
                  {isDone
                    ? <Check size={16} style={{ color: '#22c55e' }} />
                    : isActive ? <Loader2 size={16} className="spin" style={{ color: 'var(--amber)' }} /> : null}
                  <span style={{ color: isDone || isActive ? 'var(--text)' : 'var(--text-muted)', fontWeight: 600 }}>
                    Direction {l}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {isDone
                      ? 'ready'
                      : isActive
                        ? (chars > 0 ? `drawing… ${(chars / 1000).toFixed(1)}k chars` : thinking ? 'thinking…' : 'starting…')
                        : 'waiting…'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {confirmDialog}
      </div>
    );
  }

  // 2 — Variant picker (A/B/C unpicked)
  if (variants.length > 0 && realPages.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
        <div style={topBar}>
          {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back</button>}
          <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Pick a direction</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>view each one, then "Use this design"</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setPages([]); }} style={ghostBtn}>Start over</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          {variants.map((v) => (
            <button key={v.id} onClick={() => setActivePageId(v.id)} style={chip(activePage?.id === v.id)}>
              Direction {v.variant_label}
            </button>
          ))}
          {activePage && (
            <button
              onClick={() => { void handlePickVariant(activePage); }}
              disabled={busyAction === 'pick'}
              style={{ ...primaryBtn(false), marginLeft: 'auto', padding: '5px 14px' }}
            >
              {busyAction === 'pick' ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Use this design
            </button>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {activePage && (
            <DesignCanvas
              ref={canvasRef}
              // Each variant carries its own identity in its var() fallbacks —
              // don't flatten them with a shared token layer before the pick.
              pageHtml={activePage.html}
              tokensCss={null}
              device={device}
              onSelect={() => { /* selection disabled until picked */ }}
              onTextEdited={() => { /* not editable yet */ }}
            />
          )}
        </div>
        {confirmDialog}
      </div>
    );
  }

  // 3 — Main canvas experience
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', minHeight: 0 }}>
      {/* Top bar */}
      <div style={topBar}>
        {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back</button>}
        <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.name}</strong>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>
          {designChrome ? 'Design' : 'Frontend'}
        </span>
        <div style={{ flex: 1 }} />
        <div style={segmented}>
          <button onClick={() => setDevice('desktop')} style={segBtn(device === 'desktop')} aria-label="Desktop"><Monitor size={13} /></button>
          <button onClick={() => setDevice('mobile')} style={segBtn(device === 'mobile')} aria-label="Mobile"><Smartphone size={13} /></button>
        </div>
        <button onClick={() => setShowKnobs((v) => !v)} style={ghostBtn} title="Brand colors"><Palette size={13} /> Colors</button>
        <button onClick={() => { void openHistory(); }} style={ghostBtn} title="Version history"><History size={13} /> History</button>
        <button
          onClick={() => navigate(`/studio`)}
          style={{ display: 'none' }}
          aria-hidden
        />
        {designChrome && (
        <button onClick={() => { void handleContinueBuild(); }} disabled={busyAction === 'continue'} style={primaryBtn(false)}>
          {busyAction === 'continue' ? <Loader2 size={13} className="spin" /> : <Hammer size={13} />} Build this app
        </button>
        )}
        {actions}
        {designChrome && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExport((v) => !v)} style={ghostBtn} title="Export">
            <Download size={13} /> Export
          </button>
          {showExport && (
            <div style={{ ...popover, top: 34, right: 0, width: 280, position: 'absolute' }}>
              <a
                href={`/api/v1/studio/projects/${project.id}/design/export?format=zip`}
                download
                onClick={() => setShowExport(false)}
                style={exportItem}
              >
                <strong>Download ZIP</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Self-contained HTML pages + an index — open anywhere.</span>
              </a>
              <a
                href={`/api/v1/studio/projects/${project.id}/design/export?format=open-design`}
                download
                onClick={() => setShowExport(false)}
                style={exportItem}
              >
                <strong>Export for Open Design</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>DESIGN.md + tokens.css + pages/ — the open standard layout.</span>
              </a>
              <button
                type="button"
                onClick={() => { setShowExport(false); setShowConnect(true); }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Open in my own tool</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Hand the design to YOUR Claude Code / Cursor to implement it.</span>
              </button>
              <button
                type="button"
                onClick={() => { void openPublish(); }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Publish as a website</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Serve it live at name.your-domain from this server.</span>
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Publish dialog */}
      {showPublish && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowPublish(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, fontFamily: 'var(--font-sans)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>Publish as a website</strong>
              <button onClick={() => setShowPublish(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={15} /></button>
            </div>
            {site && (
              <div style={{ padding: '8px 10px', marginBottom: 12, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, #22c55e 10%, transparent)', border: '1px solid #22c55e', fontSize: '0.75rem', color: 'var(--text)' }}>
                Live at <a href={`https://${site.host}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>https://{site.host}</a> (release {site.current_release}).
                Publishing again updates it in place.
              </div>
            )}
            {domains.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                You don't have a system domain yet. Add one in Settings › Domains first — then any
                name under it (like <code>my-site.victor.claw</code>) can serve this design.
              </p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 500 }}>Address</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    value={publishSlug}
                    onChange={(e) => setPublishSlug(e.target.value.toLowerCase())}
                    placeholder="my-site"
                    style={{ ...textArea, minHeight: 0, height: 36, resize: 'none' as const, flex: 1 }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>.</span>
                  <select
                    value={publishDomainId}
                    onChange={(e) => setPublishDomainId(e.target.value)}
                    style={{ height: 36, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', padding: '0 8px', maxWidth: 180 }}
                  >
                    {domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {site && (
                    <button onClick={() => { void handleUnpublish(); }} style={{ ...ghostBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Unpublish
                    </button>
                  )}
                  <button onClick={() => { void handlePublish(); }} disabled={!publishSlug.trim() || !publishDomainId || publishing} style={primaryBtn(!publishSlug.trim() || !publishDomainId || publishing)}>
                    {publishing ? <><Loader2 size={13} className="spin" /> Publishing…</> : <>{site ? 'Publish update' : 'Publish'}</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showConnect && (
        <ConnectExternalEngineModal
          projectId={project.id}
          onClose={() => setShowConnect(false)}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Pages rail */}
        <div style={{ width: 190, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--card)' }}>
          <div style={{ padding: '10px 12px', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
            Screens
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {realPages.map((p) => (
              <div
                key={p.id}
                onClick={() => { setActivePageId(p.id); setSelection(null); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activePage?.id === p.id ? 'color-mix(in srgb, var(--amber) 8%, transparent)' : 'transparent',
                  borderLeft: activePage?.id === p.id ? '2px solid var(--amber)' : '2px solid transparent',
                  fontSize: '0.8rem', color: 'var(--text)',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>v{p.version}</span>
                {realPages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDeletePage(p); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* One-click suggestions from the concept (frontend phase). */}
          {screenSuggestions.length > 0 && (
            <div style={{ padding: '0 10px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
                From your concept
              </span>
              {screenSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => { void addPageNamed(s); }}
                  disabled={addingPage}
                  style={{ ...ghostBtn, justifyContent: 'flex-start', fontSize: '0.68rem', padding: '4px 8px' }}
                >
                  <Plus size={10} /> {s}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { void handleAddPage(); }} disabled={addingPage} style={{ ...ghostBtn, margin: 10, justifyContent: 'center' }}>
            {addingPage ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} Add screen
          </button>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {activePage && (
            <DesignCanvas
              ref={canvasRef}
              pageHtml={activePage.html}
              tokensCss={effectiveTokens}
              overridesCss={overridesCss}
              device={device}
              onSelect={setSelection}
              onTextEdited={handleTextEdited}
            />
          )}

          {/* Brand knobs popover */}
          {showKnobs && (
            <div style={popover}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text)' }}>Brand colors</strong>
                <button onClick={() => setShowKnobs(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={13} /></button>
              </div>
              {(['primary', 'accent', 'background'] as const).map((k) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                  <input
                    type="color"
                    value={knobColors[k] ?? '#888888'}
                    onChange={(e) => setKnobColors((c) => ({ ...c, [k]: e.target.value }))}
                    style={{ width: 28, height: 22, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                  />
                  {k}
                  <code style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{knobColors[k]}</code>
                </label>
              ))}
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                Changes preview live on every page. Save rewrites the design tokens.
              </p>
              <button onClick={() => { void handleSaveKnobs(); }} disabled={busyAction === 'knobs'} style={{ ...primaryBtn(false), width: '100%', justifyContent: 'center' }}>
                {busyAction === 'knobs' ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save colors
              </button>
            </div>
          )}

          {/* History popover */}
          {showHistory && (
            <div style={popover}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text)' }}>History — {activePage?.name}</strong>
                <button onClick={() => setShowHistory(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={13} /></button>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {versions.map((v) => (
                  <div key={v.version} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-dim)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text)' }}>v{v.version}</strong>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.source === 'generate' ? 'generated' : v.source === 'edit_llm' ? (v.instruction ?? 'AI edit') : v.source === 'edit_text' ? 'text edit' : (v.instruction ?? 'revert')}
                    </span>
                    {v.version !== activePage?.version && (
                      <button onClick={() => { void handleRevert(v.version); }} style={{ ...ghostBtn, padding: '2px 8px', fontSize: '0.66rem' }}>Restore</button>
                    )}
                  </div>
                ))}
                {versions.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading…</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instruction bar */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {/* Frontend phase: the instruction bar absorbs "Iterate on the
            document" — one-click starters a non-technical user can tap. */}
        {!designChrome && !selection && !instruction && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CANVAS_SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setInstruction(s)} disabled={editing} style={{ ...ghostBtn, borderRadius: 999, fontSize: '0.68rem', padding: '3px 10px' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {selection && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid var(--amber)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              &lt;{selection.tag}&gt;
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
              {selection.text || selection.path}
            </span>
            <button
              onClick={() => { if (selection) canvasRef.current?.requestTextEdit(selection.claw_id); }}
              style={ghostBtn}
              title="Edit the text directly on the canvas (no AI)"
            >
              <Type size={12} /> Edit text
            </button>
            <button
              onClick={() => { setSelection(null); canvasRef.current?.clearSelection(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              aria-label="Clear selection"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleEditWithAI(); } }}
            rows={1}
            disabled={editing}
            placeholder={selection
              ? `Change the selected <${selection.tag}> — e.g. "make it bigger and use the accent color"`
              : 'Tell me what to change on this screen — or click any element to scope the change'}
            style={{ ...textArea, minHeight: 40, height: 40 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingBottom: 10 }}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} disabled={realPages.length < 2} />
            all pages
          </label>
          <button onClick={() => { void handleEditWithAI(); }} disabled={!instruction.trim() || editing} style={primaryBtn(!instruction.trim() || editing)}>
            {editing ? <><Loader2 size={13} className="spin" /> Applying…</> : <><Wand2 size={13} /> Apply <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────

const topBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
  borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
  fontSize: '0.72rem', fontWeight: 500, background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const primaryBtn = (off: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  fontSize: '0.78rem', fontWeight: 600,
  background: off ? 'var(--surface)' : 'var(--amber)',
  color: off ? 'var(--text-muted)' : '#000',
  border: off ? '1px solid var(--border)' : 'none',
  borderRadius: 'var(--radius-md)', cursor: off ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: '0.75rem', fontWeight: active ? 700 : 500,
  background: active ? 'color-mix(in srgb, var(--amber) 12%, transparent)' : 'var(--card)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const textArea: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64,
  padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.5,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)', outline: 'none',
};
const segmented: React.CSSProperties = {
  display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 9px', display: 'inline-flex', alignItems: 'center',
  background: active ? 'var(--surface)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  border: 'none', cursor: 'pointer',
});
const popover: React.CSSProperties = {
  position: 'absolute', top: 10, right: 10, zIndex: 20, width: 280,
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: 12,
};
const exportItem: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px',
  borderRadius: 'var(--radius-sm)', textDecoration: 'none',
  color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-sans)',
  // <span> child = the explainer line
  // (kept subtle; the strong is the action)
};

export default DesignStudioPage;

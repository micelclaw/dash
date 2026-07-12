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

// ─── Frontend phase — the design studio IS the phase (convergence) ───
//
// ADR-17 amendment: instead of a markdown document with ASCII wireframes,
// the Frontend phase embeds the DesignWorkbench (3 directions → canvas →
// element edits) and Approve derives the doc_frontend contract from the
// design pages server-side. Routing here:
//   · past view             → classic read-only DocPhaseLayout (reads the
//                             derived doc + mockups comment; no canvas).
//   · legacy project        → doc_frontend exists but no design pages:
//                             classic DocPhaseLayout + a banner offering
//                             "Switch to the visual designer" (opt-in,
//                             nothing is lost — rewind keeps both).
//   · everything else       → PhaseSidebar + DesignWorkbench + Approve.

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FileText, Loader2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject, type StudioProjectStatus } from '@/stores/studio.store';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { DocPhaseLayout } from './DocPhaseLayout';
import { PhaseSidebar } from '../components/PhaseSidebar';
import { useStudioMode } from '../hooks/useStudioMode';
import { DesignWorkbench } from '../design/DesignStudioPage';
import { listDesignPages, type DesignPage } from '../design/design.service';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

const DEFAULT_PLACEHOLDER =
  'Describe the UI you have in mind: layout, density, references to existing apps, must-have screens…';

export function FrontendPhase({ project, viewMode, onSelectPhase }: Props) {
  const [studioMode] = useStudioMode();
  const guided = studioMode === 'guided';
  const approvePhase = useStudioStore((s) => s.approvePhase);
  const isPast = viewMode === 'past';

  // null = still loading. Past views ALSO fetch now (the /design GETs are
  // readable from any phase) — a project designed on the canvas shows its
  // real screens read-only instead of the derived markdown.
  const [pages, setPages] = useState<DesignPage[] | null>(null);
  const [forceCanvas, setForceCanvas] = useState(false);
  const [livePages, setLivePages] = useState<DesignPage[]>([]);
  const [approving, setApproving] = useState(false);
  const [showSpec, setShowSpec] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDesignPages(project.id)
      .then((res) => { if (!cancelled) setPages(res.pages); })
      .catch(() => { if (!cancelled) setPages([]); });
    return () => { cancelled = true; };
  }, [project.id]);

  const onPagesChanged = useCallback((p: DesignPage[]) => setLivePages(p), []);
  const hasPicked = livePages.some((p) => !p.variant_group);

  async function handleApprove() {
    if (approving) return;
    setApproving(true);
    try {
      // Server-side, approve derives doc_frontend FROM the design pages
      // (screen map + design.md fence + mockups comment) before advancing.
      await approvePhase(project.id, 'frontend', undefined);
      toast.success(guided ? 'Design approved — on to the plan' : 'Frontend approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  // ─── Read-only PAST view with real pages: the canvas, frozen ───────
  const pickedPages = (pages ?? []).filter((p) => !p.variant_group);
  if (isPast && pages !== null && pickedPages.length > 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '10px 24px 0', flexShrink: 0 }}>
          <PhaseSidebar project={project} viewedPhase="frontend" onSelect={onSelectPhase} guided={guided} />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <DesignWorkbench
            project={project}
            chrome="frontend-phase"
            readOnly
            onExit={() => { /* the page header owns navigation */ }}
          />
        </div>
      </div>
    );
  }

  // ─── Classic (legacy / past) view ─────────────────────────────────
  const legacy = !isPast && pages !== null && pages.length === 0 && !!project.doc_frontend && !forceCanvas;
  if ((isPast && pages !== null) || legacy) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {legacy && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px',
            background: 'color-mix(in srgb, var(--amber) 8%, var(--card))',
            borderBottom: '1px solid color-mix(in srgb, var(--amber) 35%, var(--border))',
            fontSize: '0.75rem', flexShrink: 0, fontFamily: 'var(--font-sans)',
          }}>
            <Wand2 size={13} style={{ color: 'var(--amber)' }} />
            <span style={{ color: 'var(--text)' }}>
              This project uses the classic document flow. The new visual designer lets you
              explore 3 directions and edit every screen on a canvas.
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setForceCanvas(true)}
              style={{
                padding: '4px 12px', fontSize: '0.7rem', fontWeight: 600,
                background: 'var(--amber)', color: '#000', border: 'none',
                borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Switch to the visual designer
            </button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ClassicFrontendDoc project={project} viewMode={viewMode} onSelectPhase={onSelectPhase} />
        </div>
      </div>
    );
  }

  // Wait for BOTH the pages fetch and the FULL project row: the gallery
  // list omits doc fields (A9), so a slim row can't be told apart from a
  // fresh canvas project — routing on it would flash the wrong surface.
  if (pages === null || project.doc_frontend === undefined) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={16} className="spin" /> Loading the design phase…
      </div>
    );
  }

  // ─── Workbench view — the phase IS the design studio ──────────────
  const approveActions = (
    <>
      {!guided && project.doc_frontend && (
        <button
          type="button"
          onClick={() => setShowSpec(true)}
          title="The derived frontend document (regenerated on approve)"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            fontSize: '0.72rem', background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <FileText size={12} /> View spec document
        </button>
      )}
      <button
        type="button"
        onClick={() => { void handleApprove(); }}
        disabled={approving || !hasPicked}
        title={hasPicked ? undefined : 'Pick a design direction first'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          fontSize: '0.78rem', fontWeight: 600,
          background: approving || !hasPicked ? 'var(--surface)' : 'var(--amber)',
          color: approving || !hasPicked ? 'var(--text-muted)' : '#000',
          border: approving || !hasPicked ? '1px solid var(--border)' : 'none',
          borderRadius: 'var(--radius-md)',
          cursor: approving || !hasPicked ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {approving ? <Loader2 size={13} className="spin" /> : null}
        {guided ? 'I like it · Continue' : 'Approve frontend'} <ArrowRight size={12} />
      </button>
    </>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 24px 0', flexShrink: 0 }}>
        <PhaseSidebar project={project} viewedPhase="frontend" onSelect={onSelectPhase} guided={guided} />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DesignWorkbench
          project={project}
          chrome="frontend-phase"
          onExit={() => { /* the page header owns navigation */ }}
          actions={approveActions}
          onPagesChanged={onPagesChanged}
        />
      </div>

      {/* Derived spec document (Pro) — read-only. */}
      {showSpec && (
        <div
          onClick={() => setShowSpec(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 760, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <FileText size={14} style={{ color: 'var(--amber)' }} />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Frontend spec (derived)</strong>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>regenerated from the canvas when you approve</span>
              <button onClick={() => setShowSpec(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              <MarkdownRenderer content={project.doc_frontend ?? ''} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The pre-convergence document experience — still the right view for
 *  past (read-only) navigation and for legacy projects that keep the
 *  classic flow. Unchanged behavior. */
function ClassicFrontendDoc({ project, viewMode, onSelectPhase }: Props) {
  const generateFrontend = useStudioStore((s) => s.generateFrontend);
  const approvePhase = useStudioStore((s) => s.approvePhase);
  const ensureTemplatesLoaded = useStudioStore((s) => s.ensureTemplatesLoaded);
  const getTemplateBySlug = useStudioStore((s) => s.getTemplateBySlug);

  useEffect(() => {
    if (project.template_slug) ensureTemplatesLoaded().catch(() => {});
  }, [project.template_slug, ensureTemplatesLoaded]);

  const template = getTemplateBySlug(project.template_slug);
  const placeholder = template?.placeholders?.frontend ?? DEFAULT_PLACEHOLDER;

  return (
    <DocPhaseLayout
      project={project}
      phase="frontend"
      docKey="doc_frontend"
      title="Frontend exploration"
      emptyHint="Ready to explore your app's UI"
      approveLabel="Approve frontend →"
      viewMode={viewMode}
      onSelectPhase={onSelectPhase}
      initialContextLabel="How do you imagine the UI?"
      initialContextPlaceholder={placeholder}
      onGenerate={async (answers) => { await generateFrontend(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'frontend', comment); }}
    />
  );
}

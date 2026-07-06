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

// ─── Studio project detail ───────────────────────────────────────────
// Phase 2 wires in the ScopingWizard for projects with status 'scoping'.
// Other statuses still show raw metadata until later phases land.

import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, Hammer, Snowflake, Eye, PackageX } from 'lucide-react';
import { useStudioStore, type StudioProjectStatus } from '@/stores/studio.store';
import { ScopingWizard } from './phases/ScopingWizard';
import { ConceptPhase } from './phases/ConceptPhase';
import { FrontendPhase } from './phases/FrontendPhase';
import { FoundationPhase } from './phases/FoundationPhase';
import { BuildPhase } from './phases/v2/BuildPhase';
import { TestingPhase } from './phases/TestingPhase';
import { PackagingPhase } from './phases/PackagingPhase';
import { LivingAppCard } from './components/LivingAppCard';
import { SandboxStatusBadge } from './components/SandboxStatusBadge';
import { DesignStudioPage } from './design/DesignStudioPage';
import { useStudioMode } from './hooks/useStudioMode';
// M22: pipeline order is a single source in lib/phases.ts (no more local
// STATUS_ORDER copies that could drift from PhaseSidebar / the backend).
import { statusIndex as indexOfStatus } from './lib/phases';

export function Component() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projects = useStudioStore((s) => s.projects);
  const fetchProjects = useStudioStore((s) => s.fetchProjects);
  const refetchProject = useStudioStore((s) => s.refetchProject);
  const loading = useStudioStore((s) => s.loading);
  const fetched = useStudioStore((s) => s.fetched);
  const [studioMode] = useStudioMode();
  const guided = studioMode === 'guided';

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, [projects.length, fetchProjects]);

  // A9: the project LIST omits the heavy doc fields, so fetch the full
  // project on open to populate them (phases read doc_concept/frontend/etc.).
  useEffect(() => {
    if (projectId) refetchProject(projectId).catch(() => {});
  }, [projectId, refetchProject]);

  const project = projects.find((p) => p.id === projectId);

  // Frozen/archived are TERMINAL states (beyond the normal pipeline). They
  // still hold every doc, so the user can browse all phases read-only; we
  // treat them as "past view" and let the clamp ceiling reach 'published'.
  const isTerminal = project?.status === 'frozen' || project?.status === 'archived';

  // Resolve which phase the user is *viewing*. The default (no query
  // param) is the project's actual current status — preserves the
  // pre-rewind UX. When `?phase=<x>` is set, clamp it to ≤ ceiling so
  // the user can never preview a future phase.
  const requestedPhase = searchParams.get('phase');
  const viewedPhase: StudioProjectStatus = (() => {
    if (!project) return 'scoping';
    const ceiling: StudioProjectStatus = isTerminal ? 'published' : project.status;
    const fallback: StudioProjectStatus = isTerminal ? 'concept' : project.status;
    if (!requestedPhase) return fallback;
    const reqIdx = indexOfStatus(requestedPhase);
    const ceilIdx = indexOfStatus(ceiling);
    if (reqIdx > ceilIdx) return fallback;
    return requestedPhase as StudioProjectStatus;
  })();
  const isPastView = !!project && !isTerminal && viewedPhase !== project.status;
  const viewMode: 'edit' | 'past' = (isPastView || isTerminal) ? 'past' : 'edit';

  // M7: when the project's status advances past the phase the user was
  // viewing AS current (an explicit `?phase` equal to the OLD status), drop
  // the stale param so they follow forward instead of being trapped in a
  // read-only past view of what they just signed off.
  const prevStatusRef = useRef(project?.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const cur = project?.status;
    prevStatusRef.current = cur;
    if (!cur || !prev || prev === cur) return;
    if (requestedPhase && requestedPhase === prev) {
      const next = new URLSearchParams(searchParams);
      next.delete('phase');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.status]);

  function selectPhase(phase: StudioProjectStatus) {
    if (!project) return;
    if (phase === project.status) {
      // Going back to "actual" — drop the query param.
      const next = new URLSearchParams(searchParams);
      next.delete('phase');
      setSearchParams(next, { replace: false });
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('phase', phase);
      setSearchParams(next, { replace: false });
    }
  }

  if (!project) {
    // Distinguish "still loading" from "loaded but this project is gone"
    // (deleted / bad deep-link) — the latter must NOT spin forever.
    const stillLoading = loading || !fetched;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        color: 'var(--text-dim)', fontSize: '0.875rem',
        fontFamily: 'var(--font-sans)',
      }}>
        {stillLoading ? (
          <>
            <Hammer size={32} style={{ color: 'var(--text-muted)' }} className="animate-pulse" />
            <span>Loading project…</span>
          </>
        ) : (
          <>
            <PackageX size={32} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Project not found</span>
            <span style={{ fontSize: '0.75rem', maxWidth: 320, textAlign: 'center' }}>
              It may have been deleted, or the link is out of date.
            </span>
          </>
        )}
        <button
          onClick={() => navigate('/studio')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={14} /> Back to projects
        </button>
      </div>
    );
  }

  // Design-only projects (target='design') get the canvas experience —
  // no phase rail, no doc phases. Conversion ("Build this app") flips the
  // target/status server-side; refetch routes it into the normal pipeline.
  if (project.target === 'design') {
    return (
      <DesignStudioPage
        project={project}
        onExit={() => navigate('/studio')}
        onProjectChanged={() => { void refetchProject(project.id); }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'hidden', fontFamily: 'var(--font-sans)',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/studio')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={14} /> {guided ? 'My apps' : 'Projects'}
        </button>
        <Hammer size={18} style={{ color: 'var(--amber)' }} />
        <h1 style={{
          fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text)',
        }}>
          {project.name}
        </h1>
        {/* Technical badges (status/level/model/sandbox) leak jargon —
            hidden in Guided; the phase rail already conveys progress. */}
        {!guided && (
        <span style={{
          fontSize: '0.6875rem',
          background: 'var(--surface)', color: 'var(--text-dim)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          {project.status}
        </span>
        )}
        {!guided && project.app_level && (
          <span style={{
            fontSize: '0.6875rem',
            background: 'var(--amber)', color: '#000',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontWeight: 600,
          }}>
            {project.app_level}
          </span>
        )}
        {!guided && project.model && (
          <span
            title="LLM model used by every phase of this project"
            style={{
              fontSize: '0.6875rem',
              background: 'var(--surface)', color: 'var(--text-dim)',
              padding: '2px 8px', borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border)',
              maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {project.model}
          </span>
        )}
        {!guided && (project.status === 'build' || project.status === 'testing' || project.status === 'packaging') && (
          <SandboxStatusBadge projectId={project.id} />
        )}
      </header>

      {isTerminal && (
        <div style={{
          padding: '12px 24px',
          background: 'color-mix(in srgb, #06b6d4 12%, var(--card))',
          borderBottom: '1px solid color-mix(in srgb, #06b6d4 40%, var(--border))',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          flexShrink: 0, fontSize: '0.8125rem',
        }}>
          <Snowflake size={16} style={{ color: '#06b6d4', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: 'var(--text)' }}>
              {project.status === 'archived' ? 'Project archived' : 'Project frozen'}
            </strong>
            <div style={{ marginTop: 2, color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5 }}>
              {project.status === 'archived'
                ? 'This project is archived. Every phase stays readable and downloadable, but you can\'t regenerate phases or run sessions.'
                : 'It exceeds the active-project limit on your current plan. It\'s still readable and downloadable, but you can\'t regenerate phases or run sessions. Upgrade your plan or delete another active project to unfreeze it.'}
              {' '}Use the phase rail below to browse it.
            </div>
          </div>
        </div>
      )}

      {isPastView && (
        <div style={{
          padding: '8px 24px',
          background: 'color-mix(in srgb, var(--amber) 10%, var(--card))',
          borderBottom: '1px solid color-mix(in srgb, var(--amber) 40%, var(--border))',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0, fontSize: '0.75rem',
        }}>
          <Eye size={12} style={{ color: 'var(--amber)' }} />
          <span style={{ color: 'var(--text)' }}>
            {guided
              ? 'You\'re viewing an earlier step (read-only).'
              : <>You are viewing the <strong>{viewedPhase}</strong> phase in read-only mode.
                  The project's current phase is <strong>{project.status}</strong>.</>}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => selectPhase(project.status)}
            style={{
              padding: '4px 10px', fontSize: '0.6875rem',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {guided ? 'Back to where I was' : 'Back to current phase'}
          </button>
        </div>
      )}

      {/* Body — phase pane (pipeline strip is rendered inside each phase
          below its own toolbar, so the page no longer reserves a left
          column for it). */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {viewedPhase === 'scoping' ? (
            <ScopingWizard
              // A7: remount when past↔edit flips so the wizard's hook count
              // never changes within a single fiber (it early-returns a
              // read-only view before its hooks in 'past' mode).
              key={`scoping-${viewMode}`}
              projectId={project.id}
              onComplete={() => { /* status refreshes from server */ }}
              viewMode={viewMode}
              project={project}
              onSelectPhase={selectPhase}
            />
          ) : viewedPhase === 'concept' ? (
            <ConceptPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'frontend' ? (
            <FrontendPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'foundation' ? (
            <FoundationPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'build' ? (
            <BuildPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'testing' ? (
            <TestingPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'packaging' || viewedPhase === 'packaged' ? (
            <PackagingPhase project={project} viewMode={viewMode} onSelectPhase={selectPhase} />
          ) : viewedPhase === 'published' ? (
            <LivingAppCard project={project} onSelectPhase={selectPhase} />
          ) : (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <div style={{
                padding: 20, background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                maxWidth: 720,
              }}>
                <h2 style={{
                  margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
                }}>
                  Nothing to show for this phase
                </h2>
                <p style={{
                  margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)',
                  lineHeight: 1.5,
                }}>
                  This phase has no content yet. Use the phase rail to move to a phase
                  the project has reached.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

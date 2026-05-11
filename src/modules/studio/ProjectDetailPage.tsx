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

import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, Hammer, Snowflake, Eye } from 'lucide-react';
import { useStudioStore, type StudioProjectStatus } from '@/stores/studio.store';
import { ScopingWizard } from './phases/ScopingWizard';
import { ConceptPhase } from './phases/ConceptPhase';
import { FrontendPhase } from './phases/FrontendPhase';
import { FoundationPhase } from './phases/FoundationPhase';
import { BuildPhase } from './phases/v2/BuildPhase';
import { TestingPhase } from './phases/TestingPhase';
import { PackagingPhase } from './phases/PackagingPhase';
import { SandboxStatusBadge } from './components/SandboxStatusBadge';

// Mirror of `core/src/studio/services/phase-advancement.ts::STATUS_ORDER`.
// Used here to clamp viewedPhase ≤ project.status so the user can never
// "preview" a phase the project hasn't reached yet.
const STATUS_ORDER: StudioProjectStatus[] = [
  'scoping', 'concept', 'frontend', 'foundation', 'build',
  'testing', 'packaging', 'packaged', 'published',
];

function indexOfStatus(status: string): number {
  const i = STATUS_ORDER.indexOf(status as StudioProjectStatus);
  return i >= 0 ? i : 0;
}

export function Component() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projects = useStudioStore((s) => s.projects);
  const fetchProjects = useStudioStore((s) => s.fetchProjects);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, [projects.length, fetchProjects]);

  const project = projects.find((p) => p.id === projectId);

  // Resolve which phase the user is *viewing*. The default (no query
  // param) is the project's actual current status — preserves the
  // pre-rewind UX. When `?phase=<x>` is set, clamp it to ≤ status so
  // the user can never preview a future phase.
  const requestedPhase = searchParams.get('phase');
  const viewedPhase: StudioProjectStatus = (() => {
    if (!project) return 'scoping';
    if (!requestedPhase) return project.status;
    const reqIdx = indexOfStatus(requestedPhase);
    const curIdx = indexOfStatus(project.status);
    if (reqIdx > curIdx) return project.status;
    return requestedPhase as StudioProjectStatus;
  })();
  const isPastView = !!project && viewedPhase !== project.status;
  const viewMode: 'edit' | 'past' = isPastView ? 'past' : 'edit';

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
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        color: 'var(--text-dim)', fontSize: '0.875rem',
        fontFamily: 'var(--font-sans)',
      }}>
        <Hammer size={32} style={{ color: 'var(--text-muted)' }} />
        <span>Loading project…</span>
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
          <ChevronLeft size={14} /> Projects
        </button>
        <Hammer size={18} style={{ color: 'var(--amber)' }} />
        <h1 style={{
          fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text)',
        }}>
          {project.name}
        </h1>
        <span style={{
          fontSize: '0.6875rem',
          background: 'var(--surface)', color: 'var(--text-dim)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          {project.status}
        </span>
        {project.app_level && (
          <span style={{
            fontSize: '0.6875rem',
            background: 'var(--amber)', color: '#000',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontWeight: 600,
          }}>
            {project.app_level}
          </span>
        )}
        {project.model && (
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
        {(project.status === 'build' || project.status === 'testing' || project.status === 'packaging') && (
          <SandboxStatusBadge projectId={project.id} />
        )}
      </header>

      {project.status === 'frozen' && (
        <div style={{
          padding: '12px 24px',
          background: 'color-mix(in srgb, #06b6d4 12%, var(--card))',
          borderBottom: '1px solid color-mix(in srgb, #06b6d4 40%, var(--border))',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          flexShrink: 0, fontSize: '0.8125rem',
        }}>
          <Snowflake size={16} style={{ color: '#06b6d4', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: 'var(--text)' }}>Project frozen</strong>
            <div style={{ marginTop: 2, color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5 }}>
              It exceeds the active-project limit on your current plan. It's still readable and downloadable,
              but you can't regenerate phases or run sessions. Upgrade your plan or delete another active project
              to unfreeze it.
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
            You are viewing the <strong>{viewedPhase}</strong> phase in read-only mode.
            The project's current phase is <strong>{project.status}</strong>.
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
            Back to current phase
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
                  Phase {project.status} — placeholder
                </h2>
                <p style={{
                  margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-dim)',
                  lineHeight: 1.5,
                }}>
                  This phase isn't implemented yet. Coming soon: session
                  planner, code generation, sandbox and packaging.
                </p>
                <pre style={{
                  margin: 0, padding: 12, background: 'var(--surface)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                  color: 'var(--text)', overflow: 'auto', maxHeight: 320,
                }}>
                  {JSON.stringify(project, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

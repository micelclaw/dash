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

// ─── Claw Studio — main viewport (Phase 1) ──────────────────────────
// Shows the user's project list with a "New project" CTA. Phases 2-11
// progressively replace the empty state with the scoping wizard,
// pipeline sidebar, code viewer, etc.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Hammer, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';
import { ProjectCard } from './components/ProjectCard';
import { OnboardingWelcome } from './components/OnboardingWelcome';
import { useConfirm } from './lib/useConfirm';

export function Component() {
  const navigate = useNavigate();
  const projects = useStudioStore((s) => s.projects);
  const loading = useStudioStore((s) => s.loading);
  const error = useStudioStore((s) => s.error);
  const fetchProjects = useStudioStore((s) => s.fetchProjects);
  const deleteProject = useStudioStore((s) => s.deleteProject);

  const { confirm, confirmDialog } = useConfirm();
  // 'onboarding' = the warm §3.1 welcome (free-text idea + example gallery).
  // Shown on demand (header CTA) and always as the empty state.
  const [view, setView] = useState<'list' | 'onboarding'>('list');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this project?',
      body: 'It will be soft-deleted — you can recover it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProject(id);
      toast.success('Project deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      toast.error(message);
    }
  }

  function handleOpen(id: string) {
    navigate(`/studio/${id}`);
  }

  function handleCreated(id: string) {
    navigate(`/studio/${id}`);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Hammer size={20} style={{ color: 'var(--amber)' }} />
          <h1 style={{
            fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text)',
          }}>
            Claw Studio
          </h1>
          {/* UX-3: was a hardcoded "PRO" badge that falsely implied a paid
              tier (shown even on Free). Neutral version tag instead. */}
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-dim)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            v3
          </span>
        </div>
        <button
          onClick={() => setView('onboarding')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--amber)', color: '#000', border: 'none',
            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New app
        </button>
      </header>

      {/* Body — single list (the Templates tab died with the unified
          funnel, ADR-18: examples are idea prefills on the create screen) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <>
        {loading && projects.length === 0 && (
          <div style={{
            color: 'var(--text-dim)', fontSize: '0.875rem', textAlign: 'center', padding: 40,
          }}>
            Loading your apps…
          </div>
        )}

        {error && (
          <div style={{
            padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--error-dim, rgba(244, 63, 94, 0.1))',
            border: '1px solid var(--error)', color: 'var(--error)',
            fontSize: '0.8125rem', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Warm onboarding (§3.1): on demand via the CTA, and always as
            the empty state. The back link only appears when there ARE
            projects to return to. */}
        {!error && (view === 'onboarding' || (!loading && projects.length === 0)) && (
          <OnboardingWelcome
            onCreated={handleCreated}
            onBack={projects.length > 0 ? () => setView('list') : undefined}
          />
        )}

        {view === 'list' && projects.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 14,
          }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        </>
      </div>

      {confirmDialog}
    </div>
  );
}


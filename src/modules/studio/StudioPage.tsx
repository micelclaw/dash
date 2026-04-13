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
import { Hammer, Plus, Sparkles, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';
import { ProjectCard } from './components/ProjectCard';
import { NewProjectModal } from './components/NewProjectModal';
import { TemplateGallery } from './components/TemplateGallery';

export function Component() {
  const navigate = useNavigate();
  const projects = useStudioStore((s) => s.projects);
  const loading = useStudioStore((s) => s.loading);
  const error = useStudioStore((s) => s.error);
  const fetchProjects = useStudioStore((s) => s.fetchProjects);
  const deleteProject = useStudioStore((s) => s.deleteProject);

  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<'projects' | 'templates'>('projects');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? It will be soft-deleted (recoverable).')) return;
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
    setModalOpen(false);
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
          <span style={{
            fontSize: '0.6875rem', color: 'var(--amber)',
            background: 'var(--amber-dim, rgba(212, 160, 23, 0.15))',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Pro
          </span>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--amber)', color: '#000', border: 'none',
            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New project
        </button>
      </header>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => setTab('projects')}
          style={tabBtn(tab === 'projects')}
        >
          <FolderKanban size={12} /> Mis proyectos ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('templates')}
          style={tabBtn(tab === 'templates')}
        >
          <Sparkles size={12} /> Plantillas
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {tab === 'templates' && (
          <TemplateGallery onInstantiated={(id) => navigate(`/studio/${id}`)} />
        )}
        {tab === 'projects' && <>
        {loading && projects.length === 0 && (
          <div style={{
            color: 'var(--text-dim)', fontSize: '0.875rem', textAlign: 'center', padding: 40,
          }}>
            Loading projects…
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

        {!loading && projects.length === 0 && !error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center',
          }}>
            <Hammer size={48} style={{ color: 'var(--amber)' }} />
            <h2 style={{
              fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', margin: 0,
            }}>
              Build your first app
            </h2>
            <p style={{
              fontSize: '0.875rem', color: 'var(--text-dim)', margin: 0, maxWidth: 460,
            }}>
              Claw Studio guides you through six phases — scoping, concept, frontend,
              foundation, implementation and packaging — to ship a real Micelclaw app
              without writing code.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                background: 'var(--amber)', color: '#000', border: 'none',
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', marginTop: 8,
              }}
            >
              <Plus size={16} />
              New project
            </button>
          </div>
        )}

        {projects.length > 0 && (
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
        </>}
      </div>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '12px 20px',
  background: 'transparent',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
  color: active ? 'var(--text)' : 'var(--text-dim)',
  fontSize: '0.75rem', fontWeight: active ? 600 : 400,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
});

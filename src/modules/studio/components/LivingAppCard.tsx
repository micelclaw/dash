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

// ─── Studio S6 — the living-app card ("el después", §3.8) ───────────
//
// Shown when a project is `published` (installed). It is HONEST about
// data: it renders only REAL signals — status, metadata, and the real
// change history (GET /studio/projects/:id/events). It deliberately does
// NOT show usage stats ("12 citas this week") because no per-app usage
// data exists in the backend (we don't fabricate). "Volver a una versión
// anterior" reuses the real rewind mechanism. Edit re-enters the build.

import { useEffect, useState } from 'react';
import {
  Sparkles, Check, Palette, RotateCcw, PackageCheck, RefreshCw, GitBranch,
  Pencil, ShieldCheck, Clock,
} from 'lucide-react';
import { useStudioStore, type StudioProject, type StudioProjectEvent, type StudioProjectStatus } from '@/stores/studio.store';
import { RewindButton } from './RewindButton';

interface LivingAppCardProps {
  project: StudioProject;
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

const KIND_ICON: Record<string, typeof Sparkles> = {
  created: Sparkles,
  phase_approved: Check,
  doc_regenerated: RefreshCw,
  design_system_set: Palette,
  design_cleared: Palette,
  rewound: RotateCcw,
  published: PackageCheck,
  checkpoint: GitBranch,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function LivingAppCard({ project, onSelectPhase }: LivingAppCardProps) {
  const fetchProjectEvents = useStudioStore((s) => s.fetchProjectEvents);
  const [events, setEvents] = useState<StudioProjectEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjectEvents(project.id)
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [project.id, fetchProjectEvents]);

  // Newest-first for the timeline.
  const timeline = events ? [...events].reverse() : null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '2rem', lineHeight: 1 }}>{project.icon || '📦'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>{project.name}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--green, #16a34a)', fontWeight: 600, marginTop: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green, #16a34a)' }} />
              Instalada y en marcha
            </div>
          </div>
        </div>

        {/* Metadata (real) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Creada el {formatDate(project.created_at)}</span>
          {project.package_version && <span>Versión {project.package_version}</span>}
          {project.app_level && <span>Nivel {project.app_level}</span>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => onSelectPhase?.('build')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Pencil size={14} /> Editar la app
          </button>
          <RewindButton projectId={project.id} target="build" label="Volver a una versión anterior" guided />
        </div>

        {/* Reassurance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} style={{ color: 'var(--green, #16a34a)' }} />
          Tus datos están a salvo. Editar la app no los borra.
        </div>

        {/* Real change history */}
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Historial de cambios</div>
          {timeline === null && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cargando…</div>}
          {timeline && timeline.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Aún no hay cambios registrados.</div>}
          {timeline && timeline.length > 0 && (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeline.map((e) => {
                const Icon = KIND_ICON[e.kind] ?? Sparkles;
                return (
                  <li key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--amber) 14%, var(--card))',
                      border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} style={{ color: 'var(--text)' }} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text)' }}>{e.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(e.created_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

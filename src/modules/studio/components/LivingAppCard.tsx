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
import { useNavigate } from 'react-router';
import {
  Sparkles, Check, Palette, RotateCcw, PackageCheck, RefreshCw, GitBranch,
  LayoutGrid, ShieldCheck, Clock, ExternalLink,
} from 'lucide-react';
import { useStudioStore, type StudioProject, type StudioProjectEvent, type StudioProjectStatus } from '@/stores/studio.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { resolveInstalledModule } from '../lib/installedApp';
import { PhaseSidebar } from './PhaseSidebar';

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
  const navigate = useNavigate();
  const [events, setEvents] = useState<StudioProjectEvent[] | null>(null);

  // The published app, if it surfaced an openable UI module, is in the
  // ui-modules store (loaded by the Shell). Resolve it via the shared helper,
  // which reads the REAL installed app_name from the project's package (not a
  // fragile kebab of the project name).
  const uiModules = useUiModulesStore((s) => s.modules);
  const appModule = resolveInstalledModule(project, uiModules);

  useEffect(() => {
    let cancelled = false;
    fetchProjectEvents(project.id)
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [project.id, fetchProjectEvents]);

  // Newest-first for the timeline, collapsing consecutive identical entries
  // (e.g. a re-install records "Instalaste la app" each time — show it once).
  const timeline = events
    ? [...events].reverse().filter((e, i, arr) => i === 0 || e.kind !== arr[i - 1]?.kind || e.label !== arr[i - 1]?.label)
    : null;

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
              Installed and running
            </div>
          </div>
        </div>

        {/* Phase rail — navigate back to any prior phase READ-ONLY (incl.
            "El diseño" = Open Design). Safe: viewing has no side effects.
            A published app can't be rewound (backend-protected), but it can
            always be reviewed. */}
        <PhaseSidebar project={project} viewedPhase="published" onSelect={onSelectPhase} guided />

        {/* Metadata (real) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Created {formatDate(project.created_at)}</span>
          {project.package_version && <span>Version {project.package_version}</span>}
          {project.app_level && <span>Level {project.app_level}</span>}
        </div>

        {/* Actions — only what actually works for a published app. Viewing
            any phase is via the rail above (read-only). "Ver el diseño" is a
            one-click shortcut to the Frontend phase where the Open Design
            previews live. (A published app is protected from rewrite/rewind;
            re-editing requires a future "nueva versión" flow.) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {appModule && (
            <button
              type="button"
              onClick={() => navigate(`/app/${appModule.app_name}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <ExternalLink size={14} /> Open the app
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectPhase?.('frontend')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: appModule ? 'var(--card)' : 'var(--amber)',
              color: appModule ? 'var(--text)' : '#000',
              border: appModule ? '1px solid var(--border)' : 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <LayoutGrid size={14} /> View the design
          </button>
        </div>

        {/* Reassurance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} style={{ color: 'var(--green, #16a34a)' }} />
          Your app is installed and safe. You can review any phase of the process from the bar above.
        </div>

        {/* Real change history */}
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Change history</div>
          {timeline === null && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading…</div>}
          {timeline && timeline.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No changes recorded yet.</div>}
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

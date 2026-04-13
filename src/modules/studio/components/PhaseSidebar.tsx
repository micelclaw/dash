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

// ─── PhaseSidebar — Studio pipeline progress rail ───────────────────
//
// Vertical list of pipeline phases. The user can click any phase up to
// the project's current `status` to navigate into a read-only view of
// that phase. Future phases (past `status`) are locked. The CURRENT
// phase shows a small "actual" pill when the user is browsing a past
// view, so it's obvious where the project really is.
//
// `viewedPhase` and `onSelect` are optional so the sidebar still works
// in places that haven't migrated to the rewind-aware layout (mostly
// during incremental refactors).

import { Check, Lock, Hammer, Sparkles, LayoutGrid, ListChecks, Rocket, Package } from 'lucide-react';
import type { StudioProject, StudioProjectStatus } from '@/stores/studio.store';

interface Props {
  project: StudioProject;
  /** Phase the user is currently *viewing* (defaults to project.status). */
  viewedPhase?: StudioProjectStatus;
  /** Click handler. If omitted, sidebar entries are non-interactive. */
  onSelect?: (phase: StudioProjectStatus) => void;
}

interface PhaseEntry {
  id: StudioProjectStatus;
  label: string;
  icon: typeof Check;
}

function buildPhases(project: StudioProject): PhaseEntry[] {
  const isL1 = project.app_level === 'L1';
  const needsUi = project.scope?.needs_ui === true;
  const phases: PhaseEntry[] = [
    { id: 'scoping', label: 'Alcance', icon: Hammer },
    { id: 'concept', label: 'Concepto', icon: Sparkles },
  ];
  if (!isL1 && needsUi) {
    phases.push({ id: 'frontend', label: 'Frontend', icon: LayoutGrid });
  }
  if (!isL1) {
    phases.push({ id: 'foundation', label: 'Foundation', icon: ListChecks });
    phases.push({ id: 'implementation', label: 'Implementación', icon: Rocket });
  }
  phases.push({ id: 'packaging', label: 'Empaquetado', icon: Package });
  return phases;
}

const STATUS_ORDER: StudioProjectStatus[] = [
  'scoping', 'concept', 'frontend', 'foundation', 'implementation',
  'testing', 'packaging', 'packaged', 'published',
];

function statusIndex(status: StudioProjectStatus): number {
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 ? i : 0;
}

export function PhaseSidebar({ project, viewedPhase, onSelect }: Props) {
  const phases = buildPhases(project);
  const currentIdx = statusIndex(project.status);
  const effectiveViewed = viewedPhase ?? project.status;
  const viewedIdx = statusIndex(effectiveViewed);

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '20px 0',
      display: 'flex', flexDirection: 'column', gap: 4,
      overflowY: 'auto',
    }}>
      <div style={{
        padding: '0 20px 12px',
        fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)', fontWeight: 600,
      }}>
        Pipeline
      </div>
      {phases.map((p) => {
        const idx = statusIndex(p.id);
        const isCurrent = p.id === project.status;
        const isViewed = idx === viewedIdx;
        const isPast = idx < currentIdx;
        const isFuture = idx > currentIdx;
        const isClickable = !isFuture && !!onSelect;

        // Icon priority: future = Lock; past completed = green check;
        // current/viewed = phase's own icon.
        const Icon = isFuture ? Lock : (isPast && !isViewed ? Check : p.icon);
        const iconColor = isViewed
          ? 'var(--amber)'
          : (isPast ? '#22c55e' : 'var(--text-muted)');

        const commonStyles: React.CSSProperties = {
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 20px',
          borderLeft: `2px solid ${isViewed ? 'var(--amber)' : 'transparent'}`,
          background: isViewed ? 'var(--card-hover)' : 'transparent',
          fontSize: '0.8125rem',
          color: isViewed ? 'var(--text)' : (isFuture ? 'var(--text-muted)' : 'var(--text-dim)'),
          fontWeight: isViewed ? 600 : 400,
          fontFamily: 'var(--font-sans)',
          textAlign: 'left' as const,
          width: '100%',
          border: 'none',
        };

        const content = (
          <>
            <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{p.label}</span>
            {isCurrent && !isViewed && (
              <span style={{
                fontSize: '0.5625rem',
                padding: '1px 6px',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                actual
              </span>
            )}
          </>
        );

        if (isClickable) {
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect!(p.id)}
              style={{ ...commonStyles, cursor: 'pointer' }}
            >
              {content}
            </button>
          );
        }
        return (
          <div
            key={p.id}
            style={{ ...commonStyles, cursor: isFuture ? 'not-allowed' : 'default' }}
          >
            {content}
          </div>
        );
      })}
    </aside>
  );
}

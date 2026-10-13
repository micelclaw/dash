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
// Horizontal strip of pipeline phases rendered inside each phase view,
// just below the phase's own toolbar. The user can click any phase up
// to the project's current `status` to navigate into a read-only view
// of that phase. Future phases (past `status`) are locked. The CURRENT
// phase shows a small "actual" pill when the user is browsing a past
// view, so it's obvious where the project really is.
//
// `viewedPhase` and `onSelect` are optional so the sidebar still works
// in places that haven't migrated to the rewind-aware layout (mostly
// during incremental refactors).

import { Check, Lock, ListChecks, Rocket, Package, FlaskConical, Palette } from 'lucide-react';
import type { StudioProject, StudioProjectStatus } from '@/stores/studio.store';
// M22: pipeline order lives in lib/phases.ts (SSOT shared with ProjectDetailPage).
import { statusIndex } from '../lib/phases';

interface Props {
  project: StudioProject;
  /** Phase the user is currently *viewing* (defaults to project.status). */
  viewedPhase?: StudioProjectStatus;
  /** Click handler. If omitted, sidebar entries are non-interactive. */
  onSelect?: (phase: StudioProjectStatus) => void;
  /** Guided mode (D5): show human phase names in the user's language
   *  instead of the technical pipeline labels. */
  guided?: boolean;
}

// Human-language phase names for Guided mode (§3 journey mapping).
const HUMAN_LABELS: Partial<Record<StudioProjectStatus, string>> = {
  design: 'Your idea & design',
  foundation: 'The plan',
  build: 'Building',
  testing: 'Test it',
  packaging: 'Install',
};

interface PhaseEntry {
  id: StudioProjectStatus;
  label: string;
  icon: typeof Check;
  /** Whether this phase applies to this project. UX-5: we ALWAYS render the
   *  full pipeline so the rail doesn't grow/shrink a step mid-journey; a phase
   *  that doesn't apply (e.g. frontend for a no-UI app) is shown dimmed and
   *  non-clickable instead of vanishing. */
  applicable: boolean;
}

// Unified funnel (ADR-18): the rail starts at Design (intake + canvas,
// pre-target) and dims per BRANCH once the target commits at Continue:
//   website        → plan + build + testing dimmed (pages ARE the site)
//   webapp/mobile  → plan dimmed (no backend of their own)
//   pre-target     → nothing dimmed (unknown ≠ inapplicable, UX-5)
// The last chip is target-aware: Install (.claw) vs Publish (static).
function buildPhases(project: StudioProject): PhaseEntry[] {
  const target = project.target;
  const preTarget = target === 'design';
  const isStatic = target === 'website' || target === 'webapp' || target === 'mobile';
  const isL1 = project.app_level === 'L1';
  const planApplies = preTarget || (!isStatic && !isL1);
  const buildApplies = preTarget || (target !== 'website' && !isL1);
  const testApplies = preTarget || target !== 'website';
  return [
    { id: 'design', label: 'Design', icon: Palette, applicable: true },
    { id: 'foundation', label: 'Plan', icon: ListChecks, applicable: planApplies },
    { id: 'build', label: 'Build', icon: Rocket, applicable: buildApplies },
    { id: 'testing', label: 'Testing', icon: FlaskConical, applicable: testApplies },
    { id: 'packaging', label: isStatic ? 'Publish' : 'Install', icon: Package, applicable: true },
  ];
}

export function PhaseSidebar({ project, viewedPhase, onSelect, guided }: Props) {
  const phases = buildPhases(project);
  const currentIdx = statusIndex(project.status);
  const effectiveViewed = viewedPhase ?? project.status;
  const viewedIdx = statusIndex(effectiveViewed);

  const items: React.ReactNode[] = [];
  phases.forEach((p, i) => {
    const idx = statusIndex(p.id);
    const isCurrent = p.id === project.status;
    const isViewed = idx === viewedIdx;
    const isPast = idx < currentIdx;
    const isFuture = idx > currentIdx;
    const isClickable = !isFuture && !!onSelect && p.applicable;

    // Icon priority: not applicable = Lock; future = Lock; past completed =
    // green check; current/viewed = phase's own icon.
    const Icon = (!p.applicable || isFuture) ? Lock : (isPast && !isViewed ? Check : p.icon);
    const iconColor = isViewed
      ? 'var(--amber)'
      : (isPast && p.applicable ? '#22c55e' : 'var(--text-muted)');

    const commonStyles: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isViewed ? 'var(--amber)' : 'transparent'}`,
      background: isViewed ? 'var(--card-hover)' : 'transparent',
      fontSize: '0.75rem',
      color: isViewed ? 'var(--text)' : (isFuture ? 'var(--text-muted)' : 'var(--text-dim)'),
      fontWeight: isViewed ? 600 : 400,
      fontFamily: 'var(--font-sans)',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      // UX-5: dim + strike-hint phases that don't apply to this project.
      opacity: p.applicable ? 1 : 0.4,
      textDecoration: p.applicable ? 'none' : 'line-through',
    };

    const content = (
      <>
        <Icon size={13} style={{ color: iconColor, flexShrink: 0 }} />
        <span>{guided ? (p.id === 'packaging' ? p.label : (HUMAN_LABELS[p.id] ?? p.label)) : p.label}</span>
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
            marginLeft: 2,
          }}>
            {guided ? 'here' : 'current'}
          </span>
        )}
      </>
    );

    items.push(
      isClickable ? (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect!(p.id)}
          style={{ ...commonStyles, cursor: 'pointer' }}
        >
          {content}
        </button>
      ) : (
        <div
          key={p.id}
          style={{ ...commonStyles, cursor: isFuture ? 'not-allowed' : 'default' }}
        >
          {content}
        </div>
      ),
    );

    if (i < phases.length - 1) {
      items.push(
        <span
          key={`${p.id}-sep`}
          aria-hidden="true"
          style={{
            width: 16, height: 1,
            background: 'var(--border)',
            flexShrink: 0,
          }}
        />,
      );
    }
  });

  return (
    <div
      role="navigation"
      aria-label="Pipeline phases"
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '8px 16px',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        gap: 4,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {items}
    </div>
  );
}

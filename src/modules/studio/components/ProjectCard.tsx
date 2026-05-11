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

// ─── ProjectCard — Studio project list item (Phase 1) ──────────────
// Minimal card showing name, status badge, and last activity. Phases
// 2-11 will add level badge, progress bar, credits, and inline actions.

import { useState } from 'react';
import { ChevronRight, Trash2, Hammer } from 'lucide-react';
import type { StudioProject, StudioProjectStatus } from '@/stores/studio.store';

interface ProjectCardProps {
  project: StudioProject;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<StudioProjectStatus, string> = {
  scoping:    'Scoping',
  concept:    'Concept',
  frontend:   'Frontend',
  foundation: 'Foundation',
  build:      'Build',
  testing:    'Testing',
  packaging:  'Packaging',
  packaged:   'Packaged',
  published:  'Published',
  archived:   'Archived',
  frozen:     'Frozen',
};

const STATUS_COLORS: Record<StudioProjectStatus, string> = {
  scoping:    'var(--amber)',
  concept:    'var(--amber)',
  frontend:   'var(--amber)',
  foundation: 'var(--amber)',
  build:      '#3b82f6',
  testing:    '#3b82f6',
  packaging:  '#3b82f6',
  packaged:   '#22c55e',
  published:  '#22c55e',
  archived:   'var(--text-muted)',
  frozen:     '#06b6d4',
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diffMs = Math.max(0, now - ts);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[project.status];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(project.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 16,
        background: 'var(--card)',
        border: `1px solid ${hovered ? statusColor : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'border-color 120ms ease, transform 120ms ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header: icon + name + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}
        >
          {project.icon ?? <Hammer size={16} style={{ color: statusColor }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.name}
          </div>
          {project.description && (
            <div style={{
              fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.description}
            </div>
          )}
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {/* Footer: status badge + level + activity + delete on hover */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
      }}>
        <span
          style={{
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: `${statusColor}1a`, color: statusColor,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
          }}
        >
          {STATUS_LABELS[project.status]}
        </span>
        {project.app_level && (
          <span style={{
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: 'var(--surface)', color: 'var(--text-dim)',
            fontWeight: 600, fontFamily: 'var(--font-mono)',
          }}>
            {project.app_level}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {formatRelative(project.last_activity_at)}
        </span>
        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            title="Delete project"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 4, background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

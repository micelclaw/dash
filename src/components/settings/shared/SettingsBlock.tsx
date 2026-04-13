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

/**
 * SettingsBlock — Reusable collapsible block for settings sections.
 *
 * Replaces the hand-coded collapsible HTML that was duplicated across
 * CanvasHostBlock, OpenclawBrandingBlock, NetworkDiscoveryBlock,
 * ModelProvidersBlock, and the internal sub-blocks of MemorySearch /
 * ChannelBindings / Hooks / Digest sections.
 *
 * Style matches the rest of the dash settings (inline styles + CSS
 * vars) for consistency. Chevron icons from lucide instead of ▼/▶.
 *
 * Props:
 * - title (required) — block header text
 * - description (optional) — small subtitle in the header (right side)
 * - expanded / onToggle (required) — controlled state from parent
 * - dirty (optional) — shows a `•` indicator next to the title
 * - saving (optional) — disables the save button + shows "Saving..."
 * - onSave (optional) — when defined, renders a "Save" button at the
 *   bottom of the expanded body. Disabled unless `dirty` is true.
 * - saveLabel (optional) — custom label for the save button
 * - footerExtra (optional) — extra node rendered to the LEFT of the save
 *   button (e.g. an external link, a "Reset" button)
 */

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SettingsBlockProps {
  title: string;
  description?: string;
  expanded: boolean;
  onToggle: () => void;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  saveLabel?: string;
  footerExtra?: ReactNode;
  children: ReactNode;
}

export function SettingsBlock({
  title,
  description,
  expanded,
  onToggle,
  dirty = false,
  saving = false,
  onSave,
  saveLabel,
  footerExtra,
  children,
}: SettingsBlockProps) {
  return (
    <div
      style={{
        marginTop: 24,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ flex: 1 }}>
          {title}
          {dirty && (
            <span
              style={{
                color: 'var(--amber)',
                marginLeft: 6,
                fontSize: '0.875rem',
                lineHeight: 1,
              }}
              aria-label="unsaved changes"
            >
              •
            </span>
          )}
        </span>
        {description && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{description}</span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {children}

          {onSave && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
                gap: 12,
              }}
            >
              {footerExtra ?? <div />}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: dirty ? 'var(--amber)' : 'var(--surface)',
                  border: dirty ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: dirty ? '#000' : 'var(--text-muted)',
                  cursor: dirty ? 'pointer' : 'default',
                  opacity: saving ? 0.7 : 1,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {saving ? 'Saving...' : dirty ? (saveLabel ?? 'Save changes') : 'Saved'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

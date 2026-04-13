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

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SettingsSidebarGroupProps {
  id: string;
  label: string;
  icon: LucideIcon;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  /** Per-group accent color, must match the landing card icon. */
  color?: string;
  children: ReactNode;
}

/**
 * Collapsible group header for the Settings sidebar. Holds a list of
 * section buttons (passed as children) underneath. Style matches the
 * existing dash sidebar pattern (inline + CSS vars).
 */
export function SettingsSidebarGroup({
  label,
  icon: Icon,
  expanded,
  onToggle,
  count,
  color,
  children,
}: SettingsSidebarGroupProps) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 8px 6px 6px',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-dim)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={13} style={color ? { color } : undefined} />
        <span style={{ flex: 1 }}>{label}</span>
        {typeof count === 'number' && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', opacity: 0.7 }}>{count}</span>
        )}
      </button>
      {expanded && <div style={{ marginLeft: 14, marginTop: 2 }}>{children}</div>}
    </div>
  );
}

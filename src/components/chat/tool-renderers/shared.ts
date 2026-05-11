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

import type { CSSProperties } from 'react';

// Common styles for all collapsed tool block pills. Compact (24-32 px),
// monochrome by default. Color is reserved for status badges (✅/❌/⏳),
// agent identity (in spawn), and small numeric indicators (+12/-3).
export const PILL_BASE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast)',
  width: '100%',
  textAlign: 'left',
};

export const ICON_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  flexShrink: 0,
};

export const SUMMARY_STYLE: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--text)',
};

export const STATUS_STYLE_BASE: CSSProperties = {
  flexShrink: 0,
  fontSize: '0.75rem',
  padding: '0 6px',
  borderRadius: 'var(--radius-full)',
};

export function statusStyle(status: 'ok' | 'error' | 'running' | 'neutral'): CSSProperties {
  switch (status) {
    case 'ok':      return { ...STATUS_STYLE_BASE, color: 'var(--success)' };
    case 'error':   return { ...STATUS_STYLE_BASE, color: 'var(--error)' };
    case 'running': return { ...STATUS_STYLE_BASE, color: 'var(--amber)' };
    default:        return { ...STATUS_STYLE_BASE, color: 'var(--text-muted)' };
  }
}

export const EXPANDED_BODY_STYLE: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderTop: 'none',
  borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-mono, monospace)',
  color: 'var(--text)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 320,
  overflow: 'auto',
};

/**
 * Truncate a string to maxLen chars, appending ellipsis. Removes
 * leading/trailing whitespace and collapses internal newlines so the
 * collapsed pill shows a single tidy line.
 */
export function truncateLine(s: unknown, maxLen = 60): string {
  if (typeof s !== 'string') return '';
  const oneLine = s.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 1) + '…';
}

/**
 * Coerce input/output to a string for display. Objects are
 * JSON.stringify'd. null/undefined → empty string.
 */
export function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

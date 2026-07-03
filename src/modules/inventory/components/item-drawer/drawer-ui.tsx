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

// Piezas internas compartidas por las secciones del ItemDrawer.

import type { CSSProperties, ReactNode } from 'react';
import { thumbUrl } from '@/modules/inventory/types';

export const sectionLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
};

export const cardStyle: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

export const editLabelStyle: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-dim)',
  marginBottom: 3,
  display: 'block',
};

export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ width: 110, flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
        {label}
      </span>
      <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text)', wordBreak: 'break-word', lineHeight: '1.5' }}>
        {value}
      </span>
    </div>
  );
}

export function PhotoThumb({ fileId, size }: { fileId: string; size: number }) {
  return (
    <img
      src={thumbUrl(fileId)}
      alt=""
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        objectFit: 'cover',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    />
  );
}

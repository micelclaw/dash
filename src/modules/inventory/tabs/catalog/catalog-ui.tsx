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

// Celdas y estilos compartidos por las vistas del catálogo (tabla/grid/modal).

import type { CSSProperties, ReactNode } from 'react';
import { Boxes } from 'lucide-react';
import { StatusPill } from '@/modules/gateway/components/StatusPill';
import { TagChip } from '@/components/shared/TagChip';
import {
  SYSTEM_STATUS_LABELS,
  STATUS_PILL_MAP,
  thumbUrl,
  daysUntil,
  type InventoryItem,
} from '@/modules/inventory/types';

export const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--bg)',
  textTransform: 'uppercase',
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  textAlign: 'left',
  padding: '6px 10px',
  whiteSpace: 'nowrap',
  zIndex: 1,
};

export const tdStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  verticalAlign: 'middle',
};

export function ItemThumb({ item, size }: { item: InventoryItem; size: number | '100%' }) {
  const fileId = item.photo_file_ids?.[0];
  const base: CSSProperties = {
    width: size,
    height: size === '100%' ? 'auto' : size,
    aspectRatio: '1 / 1',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    flexShrink: 0,
  };
  if (fileId) {
    return <img src={thumbUrl(fileId)} alt={item.name} style={{ ...base, objectFit: 'cover', display: 'block' }} />;
  }
  return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Boxes size={16} style={{ color: 'var(--text-dim)' }} />
    </div>
  );
}

export function ItemStatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const pillStatus = STATUS_PILL_MAP[status] ?? 'loading';
  const label = SYSTEM_STATUS_LABELS[status] ?? status;
  return <StatusPill status={pillStatus} label={label} size={size} />;
}

export function WarrantyCell({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  if (d < 0) return <span style={{ color: 'var(--error)' }}>expired</span>;
  return <span style={{ color: d < 90 ? 'var(--amber)' : 'var(--text)' }}>{d}d</span>;
}

export function QtyCell({ item }: { item: InventoryItem }) {
  if (!item.track_stock) return <span>{item.quantity}</span>;
  const qty = parseFloat(item.quantity);
  const min = item.min_qty !== null ? parseFloat(item.min_qty) : null;
  const low = min !== null && Number.isFinite(qty) && Number.isFinite(min) && qty < min;
  return (
    <span style={{ color: low ? 'var(--error)' : 'var(--text)' }}>
      {item.quantity}/{item.min_qty ?? '—'}
    </span>
  );
}

export function ItemTagChips({ tags, onTagClick }: { tags: string[] | null; onTagClick: (tag: string) => void }) {
  if (!tags || tags.length === 0) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(t => (
        <span key={t} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
          <TagChip tag={t} size="xs" onClick={() => onTagClick(t)} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>+{extra}</span>
      )}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
      {label}
      {children}
    </label>
  );
}

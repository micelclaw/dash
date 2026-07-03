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

// Ordenación de la tabla del catálogo (cliente, sobre los items cargados).

import type { CSSProperties } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { SYSTEM_STATUS_LABELS, daysUntil, type InventoryItem } from '@/modules/inventory/types';

export type SortKey = 'name' | 'category' | 'location' | 'qty' | 'value' | 'warranty' | 'status';
export type SortDir = 'asc' | 'desc';

function sortValue(item: InventoryItem, key: SortKey, locationNames: Map<string, string>): string | number {
  switch (key) {
    case 'name': return item.name?.toLowerCase() ?? '';
    case 'category': return item.category?.toLowerCase() ?? '';
    case 'location': return item.location_id ? (locationNames.get(item.location_id) ?? '').toLowerCase() : '';
    case 'qty': { const q = parseFloat(item.quantity); return Number.isFinite(q) ? q : 0; }
    case 'value': {
      const p = parseFloat(item.purchase_price ?? '');
      const q = parseFloat(item.quantity);
      return Number.isFinite(p) ? p * (Number.isFinite(q) ? q : 1) : -1;
    }
    case 'warranty': { const d = daysUntil(item.warranty_until); return d === null ? Number.POSITIVE_INFINITY : d; }
    case 'status': return (SYSTEM_STATUS_LABELS[item.status] ?? item.status ?? '').toLowerCase();
  }
}

export function sortItems(items: InventoryItem[], key: SortKey | null, dir: SortDir, locationNames: Map<string, string>): InventoryItem[] {
  if (!key) return items;
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = sortValue(a, key, locationNames);
    const bv = sortValue(b, key, locationNames);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv), 'es', { numeric: true }) * sign;
  });
}

/** Cabecera de columna ordenable. */
export function SortTh({ label, sortKey, active, dir, onSort, style }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (k: SortKey) => void; style: CSSProperties;
}) {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th style={style} scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
          padding: 0, font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit',
          color: active ? 'var(--text)' : 'var(--text-dim)', cursor: 'pointer',
        }}
      >
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.5 }} />
      </button>
    </th>
  );
}

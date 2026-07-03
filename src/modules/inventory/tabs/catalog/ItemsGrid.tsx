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

import { fmtMoney, type InventoryItem } from '@/modules/inventory/types';
import { ItemStatusPill, ItemThumb } from './catalog-ui';

interface ItemsGridProps {
  items: InventoryItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

/** Vista grid del catálogo: cards con thumbnail y selección múltiple. */
export function ItemsGrid({ items, selected, onToggleSelect, onOpen }: ItemsGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 8,
        padding: '12px 16px',
      }}
    >
      {items.map(item => {
        const isSel = selected.has(item.id);
        return (
          <div
            key={item.id}
            onClick={() => onOpen(item.id)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = isSel ? 'var(--mod-inventory)' : 'var(--border)'; }}
            style={{
              position: 'relative',
              background: isSel ? 'color-mix(in srgb, var(--mod-inventory) 10%, var(--card))' : 'var(--card)',
              border: `1px solid ${isSel ? 'var(--mod-inventory)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <label
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 6, left: 6, zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => onToggleSelect(item.id)}
                aria-label={`Select ${item.name}`}
                style={{ cursor: 'pointer', margin: 0 }}
              />
            </label>
            <ItemThumb item={item} size="100%" />
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.category ?? '—'} · {fmtMoney(item.purchase_price, item.currency)}
            </div>
            <div>
              <ItemStatusPill status={item.status} size="sm" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

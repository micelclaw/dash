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
import { ItemStatusPill, ItemTagChips, ItemThumb, QtyCell, WarrantyCell, tdStyle, thStyle } from './catalog-ui';
import { SortTh, type SortDir, type SortKey } from './sorting';

interface ItemsTableProps {
  items: InventoryItem[];
  locationNames: Map<string, string>;
  selected: Set<string>;
  allSelected: boolean;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (id: string) => void;
  onTagClick: (tag: string) => void;
}

/** Vista lista del catálogo: tabla ordenable con selección múltiple. */
export function ItemsTable({
  items,
  locationNames,
  selected,
  allSelected,
  sortKey,
  sortDir,
  onSort,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onTagClick,
}: ItemsTableProps) {
  const selectedCount = selected.size;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, width: 32 }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allSelected; }}
              onChange={onToggleSelectAll}
              aria-label="Select all items"
              style={{ cursor: 'pointer' }}
            />
          </th>
          <th style={{ ...thStyle, width: 38 }} />
          <SortTh label="Name" sortKey="name" active={sortKey === 'name'} dir={sortDir} onSort={onSort} style={thStyle} />
          <SortTh label="Category" sortKey="category" active={sortKey === 'category'} dir={sortDir} onSort={onSort} style={thStyle} />
          <SortTh label="Location" sortKey="location" active={sortKey === 'location'} dir={sortDir} onSort={onSort} style={thStyle} />
          <SortTh label="Qty" sortKey="qty" active={sortKey === 'qty'} dir={sortDir} onSort={onSort} style={thStyle} />
          <SortTh label="Value" sortKey="value" active={sortKey === 'value'} dir={sortDir} onSort={onSort} style={thStyle} />
          <SortTh label="Warranty" sortKey="warranty" active={sortKey === 'warranty'} dir={sortDir} onSort={onSort} style={thStyle} />
          <th style={thStyle} scope="col">Tags</th>
          <SortTh label="Status" sortKey="status" active={sortKey === 'status'} dir={sortDir} onSort={onSort} style={thStyle} />
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const isSel = selected.has(item.id);
          const baseBg = isSel ? 'color-mix(in srgb, var(--mod-inventory) 10%, transparent)' : 'transparent';
          return (
            <tr
              key={item.id}
              onClick={() => onOpen(item.id)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
              style={{ cursor: 'pointer', background: baseBg }}
            >
              <td style={tdStyle} onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={`Select ${item.name}`}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={tdStyle}><ItemThumb item={item} size={28} /></td>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                {(item.brand || item.model) && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                    {[item.brand, item.model].filter(Boolean).join(' ')}
                  </div>
                )}
              </td>
              <td style={tdStyle}>{item.category ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
              <td style={tdStyle}>
                {item.location_id
                  ? locationNames.get(item.location_id) ?? <span style={{ color: 'var(--text-dim)' }}>—</span>
                  : <span style={{ color: 'var(--text-dim)' }}>—</span>}
              </td>
              <td style={tdStyle}><QtyCell item={item} /></td>
              <td style={tdStyle}>{fmtMoney(item.purchase_price, item.currency)}</td>
              <td style={tdStyle}><WarrantyCell date={item.warranty_until} /></td>
              <td style={tdStyle}><ItemTagChips tags={item.tags} onTagClick={onTagClick} /></td>
              <td style={tdStyle}><ItemStatusPill status={item.status} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

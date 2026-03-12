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

import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { CardFilters as Filters } from '../types';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];

export function CardFilters({ compact }: { compact?: boolean }) {
  const filters = useProjectsStore((s) => s.filters);
  const setFilters = useProjectsStore((s) => s.setFilters);
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const updateFilter = (key: keyof Filters, value: string | undefined) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  const clearAll = () => setFilters({});

  if (compact) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: activeCount > 0 ? 'var(--amber-dim)' : 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: activeCount > 0 ? 'var(--amber)' : 'var(--text-dim)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Filter size={12} />
          {activeCount > 0 && <span>{activeCount}</span>}
        </button>

        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 11, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, width: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <FilterContent filters={filters} updateFilter={updateFilter} clearAll={clearAll} />
            </div>
          </>
        )}
      </div>
    );
  }

  return <FilterContent filters={filters} updateFilter={updateFilter} clearAll={clearAll} />;
}

function FilterContent({
  filters,
  updateFilter,
  clearAll,
}: {
  filters: Filters;
  updateFilter: (key: keyof Filters, value: string | undefined) => void;
  clearAll: () => void;
}) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>
        <Search size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          value={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Search cards..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)', padding: '2px 0' }}
        />
      </div>

      {/* Priority */}
      <div>
        <span style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Priority</span>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => updateFilter('priority', filters.priority === p ? undefined : p)}
              style={{
                padding: '2px 6px',
                borderRadius: 3,
                border: filters.priority === p ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: filters.priority === p ? 'var(--amber-dim)' : 'transparent',
                color: 'var(--text-dim)',
                fontSize: 10,
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}
        >
          <X size={10} /> Clear all filters
        </button>
      )}
    </div>
  );
}

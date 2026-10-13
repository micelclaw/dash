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

import { RefreshCw, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { View } from './types';

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {(['configured', 'decision', 'catalog', 'advanced'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '5px 14px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            background: view === v ? 'var(--surface-hover)' : 'transparent',
            color: view === v ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {v === 'configured' ? 'Conversación' : v === 'decision' ? 'Decisión' : v === 'catalog' ? 'Catálogo' : 'Avanzado'}
        </button>
      ))}
    </div>
  );
}

export function ModelsHeader({ isMobile, search, onSearchChange, searchPlaceholder, view, onViewChange, countLabel, onRefresh }: {
  isMobile: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  view: View;
  onViewChange: (v: View) => void;
  countLabel: string;
  onRefresh: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12, gap: 12, flexWrap: 'wrap',
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px',
        flex: isMobile ? '1 1 100%' : undefined,
        maxWidth: 280,
      }}>
        <SearchIcon size={14} style={{ color: 'var(--text-dim)' }} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            width: '100%',
          }}
        />
      </div>

      {/* View toggle */}
      <ViewToggle view={view} onChange={onViewChange} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{
          fontSize: '0.8125rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
        }}>
          {countLabel}
        </span>
        <Button variant="outline" size="icon" onClick={onRefresh} className="text-[var(--text-dim)]">
          <RefreshCw size={14} />
        </Button>
      </div>
    </div>
  );
}

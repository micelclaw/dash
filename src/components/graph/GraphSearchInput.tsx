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

import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';

interface GraphSearchInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function GraphSearchInput({ value, onChange }: GraphSearchInputProps) {
  const { t } = useI18n();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      minWidth: 160,
    }}>
      <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('graph.search.placeholder')}
        aria-label={t('graph.search.placeholder')}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 0,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          title={t('graph.search.clear')}
          aria-label={t('graph.search.clear')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 0, display: 'flex',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

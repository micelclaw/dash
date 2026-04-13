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

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SettingsSidebarSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
}

/**
 * Search input above the Settings sidebar. Supports `/` global hotkey
 * to focus (skipped while typing in another input). When non-empty,
 * the parent component switches the sidebar to a flat results view.
 */
export function SettingsSidebarSearch({ query, onQueryChange }: SettingsSidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        margin: '0 4px 8px',
      }}
    >
      <Search
        size={13}
        style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search (press /)"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onQueryChange('');
            inputRef.current?.blur();
          }
        }}
        style={{
          width: '100%',
          padding: '6px 24px 6px 26px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            onQueryChange('');
            inputRef.current?.focus();
          }}
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '50%',
          }}
          aria-label="clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

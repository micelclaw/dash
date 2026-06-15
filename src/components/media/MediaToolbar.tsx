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

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { AI_MEDIA_ENABLED } from './flags';
import { AiSearchToggle } from './AiSearchToggle';

interface MediaToolbarProps {
  search?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Reserve the AI search affordance slot (renders only when AI_MEDIA_ENABLED). */
  aiSlot?: boolean;
  /** AI/semantic search mode on (sparkle highlighted, NL placeholder). */
  aiActive?: boolean;
  /** Toggle AI/semantic search mode. */
  onAiToggle?: () => void;
  /** Placeholder shown while aiActive (natural-language hint). */
  aiPlaceholder?: string;
}

/**
 * Toolbar row for media modules: left slot, spacer, debounced search input
 * (300ms, same pattern as PhotosToolbar) and right slot. The optional AI
 * toggle docks inside the search input's right edge.
 */
export function MediaToolbar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  left,
  right,
  aiSlot = false,
  aiActive = false,
  onAiToggle,
  aiPlaceholder,
}: MediaToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
  }, [onSearchChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // Wrap on narrow viewports (≤375px phones) so filters/search/actions
        // stack instead of overflowing — shared across all media modules.
        flexWrap: 'wrap',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {left}

      <div style={{ flex: 1, minWidth: 0 }} />

      {onSearchChange && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            minWidth: 200,
          }}
        >
          <Search size={14} style={{ color: aiActive ? 'var(--amber)' : 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={aiActive && aiPlaceholder ? aiPlaceholder : searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              width: '100%',
            }}
          />
          {aiSlot && AI_MEDIA_ENABLED && <AiSearchToggle active={aiActive} onToggle={onAiToggle} />}
        </div>
      )}

      {right}
    </div>
  );
}

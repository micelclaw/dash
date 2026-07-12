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
import { useIsMobile } from '@/hooks/use-media-query';

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
 * Inline toolbar cluster for media modules: optional left slot, a debounced
 * search input (300ms, same pattern as PhotosToolbar) and an optional right
 * slot. The optional AI toggle docks inside the search input's right edge.
 *
 * It renders as a compact, content-sized cluster (no border / full-width
 * spacer) so it can live on the same row as the tabs inside MediaShell.
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
  const isMobile = useIsMobile();
  // On mobile the search box collapses to a magnifier icon so it stops hogging
  // the row and starving the tabs; tapping it expands the input inline.
  const [searchOpen, setSearchOpen] = useState(false);

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
        // Lift off the row's bottom border so the cluster sits nicely next to
        // the tabs (DrivePage pattern for right-aligned chrome items).
        marginBottom: 6,
        flexShrink: 0,
      }}
    >
      {left}

      {onSearchChange && (
        // Collapsed on mobile until tapped (keeps the tabs from being crowded
        // out); always expanded on desktop or while it has a query.
        !isMobile || searchOpen || !!localSearch ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              minWidth: isMobile ? 160 : 200,
            }}
          >
            <Search size={14} style={{ color: aiActive ? 'var(--amber)' : 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={aiActive && aiPlaceholder ? aiPlaceholder : searchPlaceholder}
              value={localSearch}
              autoFocus={isMobile && searchOpen}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleSearchInput('');
                  setSearchOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={() => { if (isMobile && !localSearch.trim()) setSearchOpen(false); }}
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Search"
              aria-label="Search"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)',
                padding: 6, cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <Search size={16} />
            </button>
            {aiSlot && AI_MEDIA_ENABLED && <AiSearchToggle active={aiActive} onToggle={onAiToggle} />}
          </div>
        )
      )}

      {right}
    </div>
  );
}

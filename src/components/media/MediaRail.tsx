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

import { Children, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface MediaRailProps {
  title: string;
  onSeeAll?: () => void;
  children: ReactNode;
}

/**
 * Horizontal scroll row of MediaCards with a section header. Each child is
 * wrapped to a fixed ~160px width with scroll snapping.
 */
export function MediaRail({ title, onSeeAll, children }: MediaRailProps) {
  return (
    <section style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-dim)',
            }}
          >
            See all
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Scroll row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x proximity',
          paddingBottom: 8,
        }}
      >
        {Children.map(children, (child) =>
          child == null ? child : (
            <div style={{ flex: '0 0 160px', minWidth: 0, scrollSnapAlign: 'start' }}>
              {child}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

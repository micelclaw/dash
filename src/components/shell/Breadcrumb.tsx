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

import { useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  const navigate = useNavigate();

  if (segments.length <= 1) return null;

  const display =
    segments.length > 3
      ? [segments[0]!, { label: '...' }, ...segments.slice(-2)]
      : segments;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
      {display.map((seg, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
          {seg.path ? (
            <button
              onClick={() => navigate(seg.path!)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: i === display.length - 1 ? 'var(--text)' : 'var(--text-dim)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'inherit',
                padding: 0,
              }}
            >
              {seg.label}
            </button>
          ) : (
            <span style={{ color: i === display.length - 1 ? 'var(--text)' : 'var(--text-dim)' }}>
              {seg.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

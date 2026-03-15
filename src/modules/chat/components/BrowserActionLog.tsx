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
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BrowserAction } from '@/stores/canvas.store';

interface BrowserActionLogProps {
  actions: BrowserAction[];
}

const VISIBLE_COUNT = 2;

export function BrowserActionLog({ actions }: BrowserActionLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) return null;

  const visible = expanded ? actions : actions.slice(-VISIBLE_COUNT);
  const hasMore = actions.length > VISIBLE_COUNT;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      maxHeight: expanded ? 200 : 'auto',
      overflowY: expanded ? 'auto' : 'hidden',
    }}>
      {/* Expand/collapse toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '3px 0',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {expanded ? 'Collapse' : `${actions.length} actions`}
        </button>
      )}

      {/* Action entries */}
      {visible.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--text-dim)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(a.timestamp)}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.humanized}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

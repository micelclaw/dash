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
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString, truncateLine } from './shared';

interface Props { tool: ToolCallRecord }

function extractQuery(input: ToolCallRecord['input']): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    return typeof o.query === 'string' ? o.query : (typeof o.q === 'string' ? o.q : '');
  }
  return '';
}

function extractResultCount(output: string, metadata: ToolCallRecord['metadata']): number | undefined {
  if (metadata && typeof metadata === 'object') {
    const o = metadata as Record<string, unknown>;
    if (typeof o.count === 'number') return o.count;
    if (typeof o.results === 'number') return o.results;
  }
  // Heuristic: try parse output as JSON with `results` array.
  try {
    const parsed = JSON.parse(output);
    if (parsed && Array.isArray(parsed.results)) return parsed.results.length;
    if (parsed && typeof parsed.count === 'number') return parsed.count;
  } catch { /* ignore */ }
  return undefined;
}

export function SearchToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const q = extractQuery(tool.input);
  const out = asString(tool.output);
  const count = extractResultCount(out, tool.metadata);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>🔍</span>
        <span style={SUMMARY_STYLE}>
          <span style={{ color: 'var(--text-dim)' }}>search · </span>
          <span>"{truncateLine(q, 60) || '(empty query)'}"</span>
        </span>
        {count != null && (
          <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {count} result{count === 1 ? '' : 's'}
          </span>
        )}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Query: {q}</div>
          {out && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              {out.slice(0, 800)}
              {out.length > 800 && <span style={{ color: 'var(--text-dim)' }}>… (+{out.length - 800} chars)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

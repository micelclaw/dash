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

function extractMemoryArgs(input: ToolCallRecord['input']): { query?: string; path?: string } {
  if (typeof input === 'string') return { query: input };
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    return {
      query: typeof o.query === 'string' ? o.query : undefined,
      path:  typeof o.path  === 'string' ? o.path  : undefined,
    };
  }
  return {};
}

function extractHits(output: string): number | undefined {
  try {
    const parsed = JSON.parse(output);
    if (parsed && Array.isArray(parsed.results)) return parsed.results.length;
    if (parsed && typeof parsed.count === 'number') return parsed.count;
  } catch { /* ignore */ }
  return undefined;
}

export function MemoryToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { query, path } = extractMemoryArgs(tool.input);
  const out = asString(tool.output);
  const hits = extractHits(out);
  const subjectText = query ? `"${truncateLine(query, 60)}"` : path ? path : '(empty)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>🧠</span>
        <span style={SUMMARY_STYLE}>
          <span style={{ color: 'var(--text-dim)' }}>memory · </span>
          <span>{subjectText}</span>
        </span>
        {hits != null && (
          <span style={{
            flexShrink: 0, fontSize: '0.6875rem',
            color: hits === 0 ? 'var(--text-dim)' : 'var(--text-muted)',
          }}>
            {hits} hit{hits === 1 ? '' : 's'}
          </span>
        )}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          {query && <div style={{ color: 'var(--text-dim)' }}>Query: {query}</div>}
          {path  && <div style={{ color: 'var(--text-dim)' }}>Path: {path}</div>}
          {out && (
            <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              {out.slice(0, 800)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString } from './shared';

interface Props { tool: ToolCallRecord }

function extractRead(input: ToolCallRecord['input']): { path: string; offset?: number; limit?: number } {
  if (typeof input === 'string') return { path: input };
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    return {
      path: typeof o.path === 'string' ? o.path : (typeof o.file === 'string' ? o.file : ''),
      offset: typeof o.offset === 'number' ? o.offset : undefined,
      limit:  typeof o.limit  === 'number' ? o.limit  : undefined,
    };
  }
  return { path: '' };
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

export function ReadToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { path, offset, limit } = extractRead(tool.input);
  const range = offset && limit ? ` L${offset}-${offset + limit}` : (limit ? ` L1-${limit}` : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>📄</span>
        <span style={SUMMARY_STYLE}>
          <span style={{ color: 'var(--text-dim)' }}>read · </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>{basename(path) || path || '(unknown)'}</span>
          {range && <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem' }}>{range}</span>}
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.6875rem', marginBottom: 4 }}>
            {path}
          </div>
          {tool.output && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              {asString(tool.output).slice(0, 800)}
              {asString(tool.output).length > 800 && <span style={{ color: 'var(--text-dim)' }}>… (+{asString(tool.output).length - 800} chars)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

function extractEdit(input: ToolCallRecord['input']): { path: string; old?: string; new?: string; isWrite?: boolean } {
  if (typeof input === 'object' && input != null) {
    const o = input as Record<string, unknown>;
    return {
      path: typeof o.file_path === 'string' ? o.file_path : (typeof o.path === 'string' ? o.path : ''),
      old:  typeof o.old_string === 'string' ? o.old_string : undefined,
      new:  typeof o.new_string === 'string' ? o.new_string : (typeof o.content === 'string' ? o.content : undefined),
      isWrite: typeof o.content === 'string' && typeof o.old_string !== 'string',
    };
  }
  return { path: '' };
}

function countLines(s: string | undefined): number {
  if (!s) return 0;
  return s.split('\n').length;
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

export function EditToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { path, old: oldStr, new: newStr, isWrite } = extractEdit(tool.input);
  const added = countLines(newStr);
  const removed = countLines(oldStr);
  const verb = isWrite ? 'write' : 'edit';
  const icon = isWrite ? '📝' : '✏️';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>{icon}</span>
        <span style={SUMMARY_STYLE}>
          <span style={{ color: 'var(--text-dim)' }}>{verb} · </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>{basename(path) || '(unknown)'}</span>
        </span>
        {(added > 0 || removed > 0) && (
          <span style={{ flexShrink: 0, fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)' }}>
            {added > 0 && <span style={{ color: 'var(--success)' }}>+{added}</span>}
            {added > 0 && removed > 0 && ' '}
            {removed > 0 && <span style={{ color: 'var(--error)' }}>-{removed}</span>}
          </span>
        )}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.6875rem', marginBottom: 6 }}>{path}</div>
          {oldStr && (
            <div style={{ background: 'rgba(239,68,68,0.08)', padding: '4px 6px', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>
              <span style={{ color: 'var(--error)', fontSize: '0.6875rem' }}>− {oldStr.slice(0, 400)}</span>
              {oldStr.length > 400 && <span style={{ color: 'var(--text-dim)' }}>… (+{oldStr.length - 400} chars)</span>}
            </div>
          )}
          {newStr && (
            <div style={{ background: 'rgba(34,197,94,0.08)', padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--success)', fontSize: '0.6875rem' }}>+ {newStr.slice(0, 400)}</span>
              {newStr.length > 400 && <span style={{ color: 'var(--text-dim)' }}>… (+{newStr.length - 400} chars)</span>}
            </div>
          )}
          {tool.output && !oldStr && !newStr && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>{asString(tool.output).slice(0, 200)}</div>
          )}
        </div>
      )}
    </div>
  );
}

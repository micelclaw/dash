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

function extractBrowse(input: ToolCallRecord['input']): { url: string; action?: string } {
  if (typeof input === 'string') return { url: input };
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    return {
      url: typeof o.url === 'string' ? o.url : '',
      action: typeof o.action === 'string' ? o.action : (typeof o.kind === 'string' ? o.kind : undefined),
    };
  }
  return { url: '' };
}

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function statusColor(code: number | undefined): string {
  if (code == null) return 'var(--text-muted)';
  if (code >= 200 && code < 300) return 'var(--success)';
  if (code >= 300 && code < 400) return 'var(--amber)';
  return 'var(--error)';
}

function extractStatus(metadata: ToolCallRecord['metadata']): number | undefined {
  if (metadata && typeof metadata === 'object') {
    const o = metadata as Record<string, unknown>;
    if (typeof o.status === 'number') return o.status;
    if (typeof o.statusCode === 'number') return o.statusCode;
    if (typeof o.status_code === 'number') return o.status_code;
  }
  return undefined;
}

export function BrowseToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { url, action } = extractBrowse(tool.input);
  const status = extractStatus(tool.metadata);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>🌐</span>
        <span style={SUMMARY_STYLE}>
          <span style={{ color: 'var(--text-dim)' }}>{action ? `${action} · ` : 'browse · '}</span>
          <span>{hostname(url) || truncateLine(url, 50) || '(no url)'}</span>
        </span>
        {status != null && (
          <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: statusColor(status) }}>{status}</span>
        )}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{url}</div>
          {tool.output && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              {asString(tool.output).slice(0, 800)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

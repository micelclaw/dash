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
import { ChevronDown, ChevronRight, Loader2, Check, AlertTriangle, Terminal } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString, truncateLine } from './shared';
import { classify } from '@/config/tool-rendering';

interface Props { tool: ToolCallRecord }

export function GenericToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const def = classify(tool.tool);
  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';

  const inputStr = asString(tool.input);
  const outputStr = asString(tool.output);
  const hasDetails = inputStr.length > 0 || outputStr.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => hasDetails && setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
      >
        {isRunning
          ? <Loader2 size={12} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
          : isError
            ? <AlertTriangle size={12} style={{ color: 'var(--error)' }} />
            : <Check size={12} style={{ color: 'var(--success)' }} />}
        <Terminal size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={SUMMARY_STYLE}>
          <span style={ICON_STYLE}>{def.icon}</span>{' '}
          <span style={{ color: 'var(--text-dim)' }}>{def.label || tool.tool} · </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
            {truncateLine(tool.summary ?? inputStr, 50)}
          </span>
        </span>
        {hasDetails && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
      </button>
      {expanded && hasDetails && (
        <div style={EXPANDED_BODY_STYLE}>
          {inputStr && (
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: 'var(--text-dim)' }}>Input:</strong>{' '}
              <span>{inputStr.slice(0, 500)}</span>
            </div>
          )}
          {outputStr && (
            <div>
              <strong style={{ color: 'var(--text-dim)' }}>Output:</strong>{' '}
              <span>{outputStr.slice(0, 500)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

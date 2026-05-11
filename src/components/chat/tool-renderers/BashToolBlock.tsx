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
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString, truncateLine } from './shared';

interface Props { tool: ToolCallRecord }

function extractCommand(input: ToolCallRecord['input']): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.command === 'string') return o.command;
    if (typeof o.cmd === 'string') return o.cmd;
    if (typeof o.script === 'string') return o.script;
  }
  return '';
}

function extractExitCode(metadata: ToolCallRecord['metadata'], output: string): number | null {
  if (metadata && typeof metadata === 'object') {
    const m = metadata as Record<string, unknown>;
    if (typeof m.exitCode === 'number') return m.exitCode;
    if (typeof m.exit_code === 'number') return m.exit_code;
  }
  // Heuristic: scan output for "exit N" trailing line.
  const m = output.match(/(?:exit|exited with)(?: code)?[ :=]+(\d+)/i);
  if (m) return parseInt(m[1]!, 10);
  return null;
}

export function BashToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cmd = extractCommand(tool.input);
  const out = asString(tool.output);
  const exit = extractExitCode(tool.metadata, out);
  const status = tool.status ?? (exit === null ? 'success' : exit === 0 ? 'success' : 'error');

  const exitBadge =
    status === 'running' ? <Loader2 size={12} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} /> :
    exit === 0           ? <span style={{ color: 'var(--success)', fontSize: '0.6875rem' }}>✓ exit 0</span> :
    exit != null         ? <span style={{ color: 'var(--error)',   fontSize: '0.6875rem' }}>✗ exit {exit}</span> :
    null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
      >
        <span style={ICON_STYLE}>💻</span>
        <span style={{ ...SUMMARY_STYLE, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>$ </span>
          {truncateLine(cmd, 70) || tool.tool}
        </span>
        {exitBadge}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          {cmd && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text-dim)' }}>$ </span>
              <span style={{ color: 'var(--text)' }}>{cmd}</span>
            </div>
          )}
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

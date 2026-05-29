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

// ─── PluginStatusToolBlock ─────────────────────────────────────────────
//
// Renderer for `tool: "plugin:<pluginId>"` events emitted by chat-bridge
// when an OpenClaw plugin writes a status line to `session.pluginDebugEntries`.
//
// The summary line follows OpenClaw's `buildPluginStatusLine` format, e.g.:
//
//   "🧩 Active Memory: status=ok elapsed=14.7s query=recent summary=29 chars"
//   "🧩 Active Memory: status=timeout_partial elapsed=15.4s query=recent summary=48 chars"
//   "🧩 Active Memory: status=empty elapsed=7.0s"
//   "🧩 Active Memory: status=unavailable elapsed=1.7s"
//
// We parse `status`, `elapsed`, and `summary` into discrete fields so the
// collapsed pill can color-code the badge (green ok / amber soft-fail /
// red error / muted otherwise) without the user having to read the line.
//
// The expanded body shows the original summary line PLUS any extra debug
// lines the plugin emitted (passed via `output`, joined with newlines —
// typically the `🔎 Active Memory Debug:` line carrying the actual recall
// content like "User's favorite color is red.").

import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { classify } from '@/config/tool-rendering';
import {
  PILL_BASE_STYLE,
  ICON_STYLE,
  SUMMARY_STYLE,
  STATUS_STYLE_BASE,
  EXPANDED_BODY_STYLE,
  truncateLine,
} from './shared';

/** Soft / partial / timeout statuses get amber. Confirmed failure → red. */
const AMBER_STATUSES = new Set(['timeout', 'timeout_partial', 'empty', 'unavailable', 'partial']);
const RED_STATUSES = new Set(['error', 'failed', 'failure', 'aborted']);

interface ParsedStatus {
  /** e.g. "ok", "timeout", "empty", "error" — empty string if not present. */
  status: string;
  /** e.g. "14.7s", "230ms" — empty string if not present. */
  elapsed: string;
  /** Numeric summary chars (e.g. 29). undefined if not present. */
  summary: number | undefined;
  /** The original line minus the prefix emoji + plugin name, for the collapsed pill. */
  rest: string;
}

/**
 * Best-effort parse of OpenClaw's plugin status line. Tolerant of missing
 * fields — only `status=...`, `elapsed=...`, `summary=N chars` are
 * recognised; the rest of the line is preserved as `rest` for display.
 */
function parseStatusLine(line: string): ParsedStatus {
  const status = /\bstatus=([a-z_][a-z0-9_-]*)/i.exec(line)?.[1] ?? '';
  const elapsed = /\belapsed=(\d+(?:\.\d+)?(?:ms|s))/i.exec(line)?.[1] ?? '';
  const summaryMatch = /\bsummary=(\d+)\s*chars?/i.exec(line);
  const summary = summaryMatch ? Number(summaryMatch[1]) : undefined;
  // Strip a leading emoji + "<Plugin Name>:" header if present so the
  // remaining preview reads cleanly when status couldn't be extracted.
  const rest = line.replace(/^[^\w]*\w[^:]*:\s*/, '').trim();
  return { status, elapsed, summary, rest };
}

function statusColor(status: string): string {
  if (!status) return 'var(--text-muted)';
  if (status === 'ok' || status === 'success') return 'var(--success)';
  if (RED_STATUSES.has(status)) return 'var(--error)';
  if (AMBER_STATUSES.has(status)) return 'var(--amber)';
  return 'var(--text-muted)';
}

const STATUS_BADGE_STYLE: CSSProperties = {
  ...STATUS_STYLE_BASE,
  fontFamily: 'var(--font-mono, monospace)',
  fontWeight: 500,
};

const DIM_META_STYLE: CSSProperties = {
  flexShrink: 0,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono, monospace)',
};

interface Props { tool: ToolCallRecord }

export function PluginStatusToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const def = classify(tool.tool);
  const summaryLine = typeof tool.summary === 'string' ? tool.summary : '';
  const parsed = parseStatusLine(summaryLine);
  const color = statusColor(parsed.status);
  const debugOutput = typeof tool.output === 'string' ? tool.output : '';
  const hasExpandable = !!debugOutput || !!summaryLine;

  return (
    <div style={{ width: '100%' }}>
      <button
        style={{
          ...PILL_BASE_STYLE,
          ...(expanded
            ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
            : {}),
        }}
        onClick={() => hasExpandable && setExpanded((v) => !v)}
      >
        <span style={ICON_STYLE}>{def.icon}</span>
        <span style={SUMMARY_STYLE}>{def.label}</span>
        {parsed.status ? (
          <span style={{ ...STATUS_BADGE_STYLE, color }}>{parsed.status}</span>
        ) : (
          <span style={SUMMARY_STYLE}>{truncateLine(parsed.rest, 60)}</span>
        )}
        {parsed.elapsed && <span style={DIM_META_STYLE}>{parsed.elapsed}</span>}
        {typeof parsed.summary === 'number' && parsed.summary > 0 && (
          <span style={DIM_META_STYLE}>{parsed.summary}c</span>
        )}
        {hasExpandable && (
          expanded
            ? <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            : <ChevronRight size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        )}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          {summaryLine && <div>{summaryLine}</div>}
          {debugOutput && (
            <div style={{ marginTop: summaryLine ? 6 : 0, color: 'var(--text-dim)' }}>
              {debugOutput}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

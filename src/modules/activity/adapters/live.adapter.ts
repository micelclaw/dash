/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Live adapter (E3) — ephemeral rolling list of tool calls happening
 * NOW across all the user's conversations. Fed by the WS event
 * `activity.tool` broadcast from Core's chat-bridge (sanitized: args
 * stripped, output truncated to 200 chars).
 *
 * No DB snapshot, no REST endpoint, no persistence — survives navigation
 * within the dash but resets on page reload. Same principle as
 * OpenClaw upstream Activity tab (5.26). See
 * docs/reference/exploration/E3-activity-tab-live.md.
 */

import { createElement } from 'react';
import type { Adapter } from './types';
import type { WsEvent } from '@/types/websocket';

export interface LiveToolRow {
  id: string;
  conversation_id: string;
  agent_name: string;
  tool: string | null;
  status: 'running' | 'done' | 'error' | string;
  arg_field_count: number;
  elapsed_ms: number | null;
  output_preview: string | null;
  started_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6',
  done: '#10b981',
  error: '#ef4444',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#64748b';
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m${secs}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return '?';
  }
}

export const liveAdapter: Adapter<LiveToolRow> = {
  tabKey: 'live',
  title: 'Live',
  iconLabel: 'L',
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'running', label: 'running' },
        { value: 'done', label: 'done' },
        { value: 'error', label: 'error' },
      ],
    },
  ],
  columns: [
    {
      key: 'time',
      label: 'Time',
      width: 'w-24',
      render: (row) =>
        createElement(
          'span',
          { className: 'tabular-nums text-[var(--text-muted)]' },
          formatTime(row.started_at),
        ),
    },
    {
      key: 'status',
      label: 'Sts',
      width: 'w-20',
      render: (row) =>
        createElement(
          'span',
          {
            className: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
            style: {
              background: `${statusColor(row.status)}22`,
              color: statusColor(row.status),
            },
          },
          row.status,
        ),
    },
    {
      key: 'agent',
      label: 'Agent',
      width: 'w-28',
      render: (row) => createElement('span', { className: 'text-xs font-medium' }, row.agent_name),
    },
    {
      key: 'tool',
      label: 'Tool',
      width: 'w-40',
      render: (row) => createElement('span', { className: 'font-mono text-xs' }, row.tool ?? '—'),
    },
    {
      key: 'elapsed',
      label: 'Elapsed',
      width: 'w-20',
      render: (row) =>
        createElement(
          'span',
          { className: 'tabular-nums text-xs text-[var(--text-muted)]' },
          formatElapsed(row.elapsed_ms),
        ),
    },
    {
      key: 'preview',
      label: 'Output preview',
      render: (row) =>
        createElement(
          'span',
          { className: 'text-xs text-[var(--text-muted)] truncate' },
          row.output_preview ?? `args: ${row.arg_field_count} fields hidden`,
        ),
    },
  ],
  // Ephemeral tab: no snapshot. The Live row buffer is filled entirely
  // by the WS subscription wired below.
  async fetchSnapshot() {
    return { rows: [] };
  },
  matchesFilters(row, filters) {
    if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
    return true;
  },
  renderDetail(row) {
    return createElement(
      'div',
      { className: 'space-y-3 text-xs' },
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Tool call ID'),
        createElement('div', { className: 'font-mono break-all' }, row.id),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Agent · tool · status'),
        createElement('div', null, row.agent_name, ' · ', row.tool ?? '—', ' · ', row.status),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Conversation'),
        createElement('div', { className: 'font-mono break-all' }, row.conversation_id),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Started · elapsed'),
        createElement('div', null, new Date(row.started_at).toLocaleString(), ' · ', formatElapsed(row.elapsed_ms)),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Args hidden — field count'),
        createElement('div', null, String(row.arg_field_count)),
      ),
      row.output_preview
        ? createElement(
            'div',
            null,
            createElement('div', { className: 'text-[var(--text-muted)]' }, 'Output preview (truncated)'),
            createElement(
              'pre',
              {
                className:
                  'mt-1 p-2 rounded bg-[var(--surface)] border border-[var(--border)] overflow-auto whitespace-pre-wrap break-all max-h-72',
              },
              row.output_preview,
            ),
          )
        : null,
    );
  },
  getRowKey: (row) => row.id,
  histogramOf: (row) => ({ time: row.started_at, bucket: row.status }),
};

/**
 * WS transform for the Live tab. Returns null when the event isn't a
 * well-formed `activity.tool` payload.
 */
export function transformActivityToolEvent(event: WsEvent): LiveToolRow | null {
  const data = (event.data ?? {}) as Partial<LiveToolRow>;
  if (!data.id || typeof data.id !== 'string') return null;
  return {
    id: data.id,
    conversation_id: data.conversation_id ?? '',
    agent_name: data.agent_name ?? '?',
    tool: typeof data.tool === 'string' ? data.tool : null,
    status: typeof data.status === 'string' ? data.status : 'running',
    arg_field_count: typeof data.arg_field_count === 'number' ? data.arg_field_count : 0,
    elapsed_ms: typeof data.elapsed_ms === 'number' ? data.elapsed_ms : null,
    output_preview: typeof data.output_preview === 'string' ? data.output_preview : null,
    started_at: typeof data.started_at === 'string' ? data.started_at : new Date().toISOString(),
  };
}

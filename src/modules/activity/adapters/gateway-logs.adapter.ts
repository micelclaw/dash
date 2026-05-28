/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Gateway logs adapter — OpenClaw NDJSON log entries. The legacy
 * gateway/tabs/LogsTab.tsx remains until session 9 retires it; this
 * adapter is the new home for the same WS feed.
 */

import { createElement } from 'react';
import { getGatewayLogs } from '@/services/activity.service';
import type { GatewayLogEntry } from '@/services/activity.service';
import type { Adapter } from './types';
import { severityColor } from './types';

const LEVELS = [
  { value: 'debug', label: 'debug' },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' },
  { value: 'trace', label: 'trace' },
];

function formatTime(iso: string): string {
  // OpenClaw uses RFC3339 with milliseconds. The locale string is
  // fine; we want it in the user's TZ.
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

// Use a deterministic row key — Gateway logs have no id, so we
// concatenate timestamp + message hash for dedupe purposes.
function rowKey(entry: GatewayLogEntry, index?: number): string {
  return `${entry.timestamp}|${entry.source ?? ''}|${entry.message.length}|${entry.message.slice(0, 64)}|${index ?? ''}`;
}

export const gatewayLogsAdapter: Adapter<GatewayLogEntry> = {
  tabKey: 'gateway',
  title: 'Gateway logs',
  iconLabel: 'G',
  filters: [
    { key: 'level', label: 'Level', options: LEVELS },
  ],
  columns: [
    {
      key: 'time',
      label: 'Time',
      width: 'w-28',
      render: (row) => createElement('span', { className: 'tabular-nums text-[var(--text-muted)]' }, formatTime(row.timestamp)),
    },
    {
      key: 'level',
      label: 'Lvl',
      width: 'w-16',
      render: (row) => createElement(
        'span',
        {
          className: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
          style: {
            background: `${severityColor(row.level)}22`,
            color: severityColor(row.level),
          },
        },
        row.level,
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: 'w-40',
      render: (row) => createElement('span', { className: 'font-mono text-xs text-[var(--text-muted)]' }, row.source ?? '—'),
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => createElement('span', { className: 'text-xs whitespace-pre-wrap break-words' }, row.message),
    },
  ],
  async fetchSnapshot({ range }) {
    const res = await getGatewayLogs({ limit: 500, from: range?.from, to: range?.to });
    return { rows: res.entries };
  },
  matchesFilters(row, filters) {
    if (filters.level && filters.level !== 'all' && row.level !== filters.level) return false;
    return true;
  },
  renderDetail(row) {
    return createElement(
      'div',
      { className: 'space-y-3 text-xs' },
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'When'),
        createElement('div', null, new Date(row.timestamp).toLocaleString()),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Level · Source'),
        createElement('div', null, row.level, ' · ', row.source ?? '—'),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Message'),
        createElement(
          'pre',
          { className: 'mt-1 p-2 rounded bg-[var(--surface)] border border-[var(--border)] overflow-auto whitespace-pre-wrap break-all max-h-96' },
          row.message,
        ),
      ),
    );
  },
  getRowKey: rowKey,
  histogramOf: (row) => ({ time: row.timestamp, bucket: row.level.toLowerCase() }),
};

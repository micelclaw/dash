/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Core (pino) logs adapter — tails data/logs/core/core.log via
 * GET /core/logs and the `core.logs.entry` WS topic.
 */

import { createElement } from 'react';
import { getCoreLogs } from '@/services/activity.service';
import type { CoreLogEntry } from '@/services/activity.service';
import type { Adapter } from './types';
import { severityColor } from './types';

const LEVELS = [
  { value: 'trace', label: 'trace' },
  { value: 'debug', label: 'debug' },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' },
  { value: 'fatal', label: 'fatal' },
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function rowKey(entry: CoreLogEntry, index?: number): string {
  // Pino lines don't carry an id either — same dedupe approach as
  // gateway logs.
  return `${entry.timestamp}|${entry.req_id ?? ''}|${entry.source ?? ''}|${entry.message.slice(0, 80)}|${index ?? ''}`;
}

export const coreLogsAdapter: Adapter<CoreLogEntry> = {
  tabKey: 'core',
  title: 'System (Core)',
  iconLabel: 'S',
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
      width: 'w-32',
      render: (row) => createElement('span', { className: 'font-mono text-xs text-[var(--text-muted)]' }, row.source ?? '—'),
    },
    {
      key: 'reqId',
      label: 'reqId',
      width: 'w-28',
      render: (row) => row.req_id
        ? createElement('span', { className: 'font-mono text-xs text-[var(--text-muted)]' }, row.req_id)
        : createElement('span', { className: 'text-[var(--text-muted)]' }, '—'),
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => createElement('span', { className: 'text-xs whitespace-pre-wrap break-words' }, row.message),
    },
  ],
  async fetchSnapshot() {
    // Don't filter here — useActivityRows applies matchesFilters() to
    // both snapshot and live WS rows so they stay consistent when the
    // user changes the dropdown.
    const res = await getCoreLogs({ limit: 500, tailBytes: 512 * 1024 });
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
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Level · Source · reqId'),
        createElement('div', null, row.level, ' · ', row.source ?? '—', ' · ', row.req_id ?? '—'),
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
      row.raw && createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Raw pino frame'),
        createElement(
          'pre',
          { className: 'mt-1 p-2 rounded bg-[var(--surface)] border border-[var(--border)] overflow-auto whitespace-pre-wrap break-all max-h-72 text-[10px]' },
          JSON.stringify(row.raw, null, 2),
        ),
      ),
    );
  },
  getRowKey: rowKey,
};

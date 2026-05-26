/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Container logs adapter — feeds the Activity Center Containers tab.
 *
 * Two modes:
 *  - per-service (default): one service selected, tail via
 *    GET /lifecycle/services/:svc/logs.
 *  - merged: aggregate snapshot across every service via
 *    GET /lifecycle/services/logs, ordered by timestamp.
 *
 * The selected service is carried via the `service` filter (special
 * value `__merged__` for the merged mode). The tab component is
 * responsible for populating the option list from
 * GET /lifecycle/services/logs/active.
 */

import { createElement } from 'react';
import {
  getServiceLogs,
  getMergedContainerLogs,
} from '@/services/activity.service';
import type {
  ContainerLogEntry,
  MergedContainerLogsResponse,
} from '@/services/activity.service';
import type { Adapter } from './types';

export const MERGED_SENTINEL = '__merged__';

export interface ContainerLogRow extends ContainerLogEntry {
  /** Synthetic service tag — present in merged mode. */
  service?: string;
}

const STREAMS = [
  { value: 'stdout', label: 'stdout' },
  { value: 'stderr', label: 'stderr' },
];

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function rowKey(entry: ContainerLogRow, index?: number): string {
  return `${entry.timestamp}|${entry.service ?? ''}|${entry.stream}|${entry.message.slice(0, 80)}|${index ?? ''}`;
}

/**
 * Build an adapter pre-bound to a list of available services so the
 * filter dropdown is populated. Pass an empty list while loading; the
 * tab will rebuild when the list is fetched.
 */
export function buildContainerLogsAdapter(serviceList: string[]): Adapter<ContainerLogRow> {
  const serviceOptions = [
    { value: MERGED_SENTINEL, label: 'Todos (merged)' },
    ...serviceList.map((s) => ({ value: s, label: s })),
  ];

  return {
    tabKey: 'containers',
    title: 'Containers',
    iconLabel: 'C',
    filters: [
      { key: 'service', label: 'Servicio', options: serviceOptions },
      { key: 'stream',  label: 'Stream',   options: STREAMS },
    ],
    columns: [
      {
        key: 'time',
        label: 'Time',
        width: 'w-28',
        render: (row) => createElement('span', { className: 'tabular-nums text-[var(--text-muted)]' }, formatTime(row.timestamp)),
      },
      {
        key: 'service',
        label: 'Service',
        width: 'w-32',
        render: (row) => createElement('span', { className: 'font-mono text-xs text-[var(--text-muted)]' }, row.service ?? '—'),
      },
      {
        key: 'stream',
        label: 'Stream',
        width: 'w-20',
        render: (row) => createElement(
          'span',
          {
            className: `inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
              row.stream === 'stderr' ? 'bg-red-500/15 text-red-500' : 'bg-slate-500/15 text-slate-400'
            }`,
          },
          row.stream,
        ),
      },
      {
        key: 'message',
        label: 'Message',
        render: (row) => createElement('span', { className: 'text-xs whitespace-pre-wrap break-words' }, row.message),
      },
    ],
    async fetchSnapshot({ filters }) {
      const svc = filters.service && filters.service !== 'all' ? filters.service : MERGED_SENTINEL;
      let rows: ContainerLogRow[] = [];
      if (svc === MERGED_SENTINEL) {
        const res: MergedContainerLogsResponse = await getMergedContainerLogs({ tailBytes: 64 * 1024, limit: 500 });
        rows = res.entries.map((e) => ({ ...e, service: e.service }));
      } else if (svc) {
        const res = await getServiceLogs(svc, { tailBytes: 256 * 1024, limit: 500 });
        rows = res.entries.map((e) => ({ ...e, service: svc }));
      }
      if (filters.stream && filters.stream !== 'all') {
        rows = rows.filter((r) => r.stream === filters.stream);
      }
      return { rows };
    },
    renderDetail(row) {
      return createElement(
        'div',
        { className: 'space-y-3 text-xs' },
        createElement(
          'div',
          null,
          createElement('div', { className: 'text-[var(--text-muted)]' }, 'When'),
          createElement('div', null, row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'),
        ),
        createElement(
          'div',
          null,
          createElement('div', { className: 'text-[var(--text-muted)]' }, 'Service · Stream'),
          createElement('div', null, (row.service ?? '—'), ' · ', row.stream),
        ),
        createElement(
          'div',
          null,
          createElement('div', { className: 'text-[var(--text-muted)]' }, 'Message'),
          createElement(
            'pre',
            { className: 'mt-1 p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-base)] overflow-auto whitespace-pre-wrap break-all max-h-96' },
            row.message,
          ),
        ),
      );
    },
    getRowKey: rowKey,
  };
}

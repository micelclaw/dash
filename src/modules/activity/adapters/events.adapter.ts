/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Events adapter — bus events from `GET /agent-events`. The live
 * WS subscription is wired by the tab component (it needs the React
 * effect lifecycle); the adapter itself is the pure transport layer.
 */

import { createElement } from 'react';
import { listEvents } from '@/services/activity.service';
import type { AgentEventRow } from '@/services/activity.service';
import type { Adapter } from './types';
import { severityColor } from './types';

const SEVERITIES = ['debug', 'info', 'warn', 'error', 'critical'] as const;

const DOMAIN_PREFIXES: Array<{ value: string; label: string }> = [
  { value: 'auth.', label: 'auth.*' },
  { value: 'admin.', label: 'admin.*' },
  { value: 'system.', label: 'system.*' },
  { value: 'lifecycle.', label: 'lifecycle.*' },
  { value: 'agent.', label: 'agent.*' },
  { value: 'gateway.', label: 'gateway.*' },
  { value: 'billing.', label: 'billing.*' },
  { value: 'sandbox.', label: 'sandbox.*' },
  { value: 'voice.', label: 'voice.*' },
  { value: 'browser.', label: 'browser.*' },
  { value: 'mcp.', label: 'mcp.*' },
  { value: 'studio.', label: 'studio.*' },
  { value: 'job.', label: 'job.*' },
  { value: 'openclaw.', label: 'openclaw.*' },
  { value: 'activity.', label: 'activity.*' },
];

function snippet(payload: Record<string, unknown>): string {
  // Drop heavy fields and stringify the rest, truncated.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'stack' || k === 'evidence' || k === 'raw') continue;
    if (typeof v === 'string' && v.length > 80) cleaned[k] = v.slice(0, 80) + '…';
    else cleaned[k] = v;
  }
  const json = JSON.stringify(cleaned);
  return json.length > 120 ? json.slice(0, 120) + '…' : json;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

export const eventsAdapter: Adapter<AgentEventRow> = {
  tabKey: 'events',
  title: 'Events',
  iconLabel: 'E',
  filters: [
    {
      key: 'severity',
      label: 'Severity',
      options: SEVERITIES.map((s) => ({ value: s, label: s })),
    },
    {
      key: 'domain',
      label: 'Domain',
      options: DOMAIN_PREFIXES,
    },
  ],
  columns: [
    {
      key: 'time',
      label: 'Time',
      width: 'w-24',
      render: (row) => createElement('span', { className: 'tabular-nums text-[var(--text-muted)]' }, formatTime(row.created_at)),
    },
    {
      key: 'severity',
      label: 'Sev',
      width: 'w-20',
      render: (row) => createElement(
        'span',
        {
          className: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
          style: {
            background: `${severityColor(row.severity)}22`,
            color: severityColor(row.severity),
          },
        },
        row.severity,
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 'w-72',
      render: (row) => createElement('span', { className: 'font-mono text-xs' }, row.type),
    },
    {
      key: 'payload',
      label: 'Payload',
      render: (row) => createElement('span', { className: 'text-xs text-[var(--text-muted)]' }, snippet(row.payload)),
    },
  ],
  async fetchSnapshot({ limit, range }) {
    const events = await listEvents({ limit, from: range?.from, to: range?.to });
    return { rows: events.events };
  },
  matchesFilters(row, filters) {
    if (filters.severity && filters.severity !== 'all' && row.severity !== filters.severity) return false;
    if (filters.domain && filters.domain !== 'all' && !row.type.startsWith(filters.domain)) return false;
    return true;
  },
  renderDetail(row) {
    return createElement(
      'div',
      { className: 'space-y-3 text-xs' },
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Event ID'),
        createElement('div', { className: 'font-mono break-all' }, row.id),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Type / Severity'),
        createElement('div', null, row.type, ' · ', row.severity, ' · v', row.schema_version),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'When'),
        createElement('div', null, new Date(row.created_at).toLocaleString()),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Payload'),
        createElement(
          'pre',
          { className: 'mt-1 p-2 rounded bg-[var(--surface)] border border-[var(--border)] overflow-auto whitespace-pre-wrap break-all max-h-72' },
          JSON.stringify(row.payload, null, 2),
        ),
      ),
    );
  },
  getRowKey: (row) => row.id,
  histogramOf: (row) => ({ time: row.created_at, bucket: row.severity }),
};

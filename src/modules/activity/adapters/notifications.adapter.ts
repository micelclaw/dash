/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Notifications adapter — approximate history of dispatched push
 * notifications. Core doesn't persist them in a dedicated table; the
 * /activity/notifications-history endpoint returns the underlying bus
 * events whose type matches a built-in rule. Close enough to be
 * actionable; the dash labels each row with the rule_key that fired.
 */

import { createElement } from 'react';
import { getNotificationsHistory } from '@/services/activity.service';
import type { NotificationHistoryRow } from '@/services/activity.service';
import type { Adapter } from './types';
import { severityColor } from './types';

const RULES = [
  { value: 'system.error.critical',         label: 'system.error.critical' },
  { value: 'lifecycle.service.failed',      label: 'lifecycle.service.failed' },
  { value: 'auth.brute_force.detected',     label: 'auth.brute_force.detected' },
  { value: 'billing.plan_limit.exceeded',   label: 'billing.plan_limit.exceeded' },
];

function describeRow(row: NotificationHistoryRow): string {
  const p = row.payload;
  if (row.type === 'lifecycle.service.failed') {
    return `Servicio caído: ${p.display_name ?? p.service ?? '?'}`;
  }
  if (row.type === 'system.error.unhandled') {
    return `Error crítico ${p.status_code ?? ''} en ${p.route ?? p.url ?? '(sin route)'}`;
  }
  if (row.type === 'auth.login.failed') {
    return `Login fallido para ${p.email ?? '?'}`;
  }
  if (row.type === 'billing.plan_limit.exceeded') {
    return `Límite del plan alcanzado: ${p.limit_type ?? ''}`;
  }
  return row.type;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

export const notificationsAdapter: Adapter<NotificationHistoryRow> = {
  tabKey: 'notifications',
  title: 'Notifications',
  iconLabel: 'N',
  filters: [
    {
      key: 'rule',
      label: 'Regla',
      options: RULES,
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
      key: 'rule',
      label: 'Regla',
      width: 'w-56',
      render: (row) => createElement('span', { className: 'font-mono text-xs' }, row.rule_key ?? '(none)'),
    },
    {
      key: 'title',
      label: 'Título',
      render: (row) => createElement('span', { className: 'text-xs' }, describeRow(row)),
    },
  ],
  async fetchSnapshot({ limit }) {
    const rows = await getNotificationsHistory({ windowHours: 24, limit });
    return { rows };
  },
  matchesFilters(row, filters) {
    if (filters.rule && filters.rule !== 'all' && row.rule_key !== filters.rule) return false;
    return true;
  },
  renderDetail(row) {
    return createElement(
      'div',
      { className: 'space-y-3 text-xs' },
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Rule'),
        createElement('div', { className: 'font-mono' }, row.rule_key ?? '—'),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Event'),
        createElement('div', null, row.type, ' · ', row.severity),
      ),
      createElement(
        'div',
        null,
        createElement('div', { className: 'text-[var(--text-muted)]' }, 'Event ID'),
        createElement('div', { className: 'font-mono break-all' }, row.id),
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

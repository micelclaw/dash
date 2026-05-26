/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — shared header rendered above every tab.
 * Stacked-bar histogram of the last 24h + the adapter's filter facets.
 */

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Adapter } from './adapters/types';
import { SEVERITY_COLORS } from './adapters/types';
import type { ActivityStats } from '@/services/activity.service';

interface Props<Row> {
  adapter: Adapter<Row>;
  stats: ActivityStats | null;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  paused?: boolean;
  onTogglePause?: () => void;
}

interface HourBucket {
  hour: string;       // human label "13h"
  fullHour: string;   // ISO truncated to hour
  [severity: string]: string | number;
}

/**
 * Group the flat histogram rows into one row per hour with one column
 * per severity, suitable for a recharts stacked Bar.
 */
function buildHourBuckets(stats: ActivityStats | null): { rows: HourBucket[]; severities: string[] } {
  if (!stats) return { rows: [], severities: [] };
  const byHour = new Map<string, HourBucket>();
  const severities = new Set<string>();
  for (const row of stats.events.histogram) {
    severities.add(row.severity);
    const existing = byHour.get(row.bucket);
    if (existing) {
      existing[row.severity] = ((existing[row.severity] as number) ?? 0) + row.count;
    } else {
      const d = new Date(row.bucket);
      byHour.set(row.bucket, {
        hour: `${String(d.getHours()).padStart(2, '0')}h`,
        fullHour: row.bucket,
        [row.severity]: row.count,
      } as HourBucket);
    }
  }
  return {
    rows: Array.from(byHour.values()).sort((a, b) => a.fullHour.localeCompare(b.fullHour)),
    severities: Array.from(severities),
  };
}

const SEVERITY_ORDER = ['debug', 'info', 'warn', 'error', 'critical'];

export function ActivityHeader<Row>({
  adapter,
  stats,
  filters,
  onFilterChange,
  search,
  onSearchChange,
  paused,
  onTogglePause,
}: Props<Row>) {
  const { rows, severities } = useMemo(() => buildHourBuckets(stats), [stats]);
  const orderedSeverities = SEVERITY_ORDER.filter((s) => severities.includes(s)).concat(
    severities.filter((s) => !SEVERITY_ORDER.includes(s)),
  );

  return (
    <div className="border-b border-[var(--border-base)] bg-[var(--bg-base)]">
      {/* Histogram */}
      <div className="h-32 px-3 pt-2">
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={32} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-base)',
                  fontSize: 11,
                }}
              />
              {orderedSeverities.map((sev) => (
                <Bar key={sev} dataKey={sev} stackId="a" fill={SEVERITY_COLORS[sev] ?? '#64748b'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
            Sin actividad en las últimas 24h
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-[var(--border-subtle)]">
        {adapter.filters.map((facet) => (
          <select
            key={facet.key}
            value={filters[facet.key] ?? 'all'}
            onChange={(e) => onFilterChange(facet.key, e.target.value)}
            className="text-xs px-2 py-1 rounded border border-[var(--border-base)] bg-[var(--bg-surface)]"
            aria-label={facet.label}
          >
            <option value="all">{facet.label}: todos</option>
            {facet.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar…"
          className="flex-1 min-w-[120px] text-xs px-2 py-1 rounded border border-[var(--border-base)] bg-[var(--bg-surface)]"
        />
        {onTogglePause && (
          <button
            onClick={onTogglePause}
            className="text-xs px-2 py-1 rounded border border-[var(--border-base)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]"
            aria-pressed={paused}
          >
            {paused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
        )}
      </div>
    </div>
  );
}

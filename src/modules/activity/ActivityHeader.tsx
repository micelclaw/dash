/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — shared header rendered above every tab.
 *
 * The line histogram is now derived from the tab's CURRENT rows
 * (snapshot + live), grouped by hour, with one line per categorical
 * bucket the adapter declares via `histogramOf` (severity / log
 * level / docker stream / etc.). Each tab therefore shows ITS own
 * shape — and the chart reacts to filters automatically because
 * filteredRows feeds in.
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Adapter } from './adapters/types';
import { bucketColor } from './adapters/types';

interface Props<Row> {
  adapter: Adapter<Row>;
  rows: Row[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  paused?: boolean;
  onTogglePause?: () => void;
}

interface HourPoint {
  hour: string;       // human label "13h"
  fullHour: string;   // ISO truncated to hour
  [bucket: string]: string | number;
}

/**
 * Group rows by (hour, bucket) into a recharts-friendly series.
 * Skips rows whose timestamp can't be parsed.
 */
function buildHistogram<Row>(
  rows: Row[],
  project: (row: Row) => { time: string; bucket: string } | null,
): { points: HourPoint[]; buckets: string[] } {
  const byHour = new Map<string, HourPoint>();
  const buckets = new Set<string>();
  for (const row of rows) {
    const p = project(row);
    if (!p) continue;
    const t = new Date(p.time);
    if (Number.isNaN(t.getTime())) continue;
    // Truncate to the hour (local time) for the X axis.
    const hourKey = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours()).toISOString();
    buckets.add(p.bucket);
    const existing = byHour.get(hourKey);
    if (existing) {
      existing[p.bucket] = ((existing[p.bucket] as number) ?? 0) + 1;
    } else {
      byHour.set(hourKey, {
        hour: `${String(t.getHours()).padStart(2, '0')}h`,
        fullHour: hourKey,
        [p.bucket]: 1,
      } as HourPoint);
    }
  }
  // Ensure every point carries 0 for every bucket so recharts joins
  // the line across gaps instead of dropping the segment.
  const bucketList = Array.from(buckets);
  const points = Array.from(byHour.values())
    .sort((a, b) => a.fullHour.localeCompare(b.fullHour))
    .map((p) => {
      for (const b of bucketList) if (p[b] === undefined) p[b] = 0;
      return p;
    });
  return { points, buckets: bucketList };
}

// Severity / level natural order. Buckets outside this set (e.g. docker
// streams stdout/stderr, rule keys) keep insertion order after these.
const KNOWN_ORDER = ['trace', 'debug', 'info', 'warn', 'error', 'critical', 'fatal'];

export function ActivityHeader<Row>({
  adapter,
  rows,
  filters,
  onFilterChange,
  search,
  onSearchChange,
  paused,
  onTogglePause,
}: Props<Row>) {
  const { points, buckets } = useMemo(() => {
    if (!adapter.histogramOf) return { points: [], buckets: [] };
    return buildHistogram(rows, adapter.histogramOf);
  }, [rows, adapter]);

  const orderedBuckets = useMemo(
    () =>
      KNOWN_ORDER.filter((b) => buckets.includes(b)).concat(
        buckets.filter((b) => !KNOWN_ORDER.includes(b)),
      ),
    [buckets],
  );

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]">
      {/* Per-tab histogram, ~2× the original height so trends read at a
          glance. Empty state when there's no data or the adapter
          doesn't declare a histogram projection. */}
      <div className="h-64 px-3 pt-2 pb-1">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--text)',
                  padding: '6px 8px',
                }}
                labelStyle={{ color: 'var(--text)', fontWeight: 500 }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Legend
                verticalAlign="top"
                height={20}
                iconType="line"
                wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }}
              />
              {orderedBuckets.map((b) => (
                <Line
                  key={b}
                  type="monotone"
                  dataKey={b}
                  stroke={bucketColor(b)}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
            Sin actividad en este tab
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-[var(--border)]">
        {adapter.filters.map((facet) => (
          <select
            key={facet.key}
            value={filters[facet.key] ?? 'all'}
            onChange={(e) => onFilterChange(facet.key, e.target.value)}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)]"
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
          className="flex-1 min-w-[120px] text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)]"
        />
        {onTogglePause && (
          <button
            onClick={onTogglePause}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
            aria-pressed={paused}
          >
            {paused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
        )}
      </div>
    </div>
  );
}

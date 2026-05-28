/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — shared header rendered above every tab.
 *
 * The line histogram is derived from the tab's CURRENT rows (snapshot
 * + live), with one line per categorical bucket the adapter declares
 * via `histogramOf` (severity / log level / docker stream / etc.).
 *
 * Granularity is chosen automatically from the row timespan:
 *   - < 3 hours of data → bucket per minute
 *   - < 7 days          → bucket per hour
 *   - ≥ 7 days          → bucket per day
 *
 * Gaps inside the range are filled with explicit zero so the line
 * doesn't break across empty slots. With ≤ 5 data points the chart
 * also shows dots — a 1-2 point dataset would otherwise be invisible
 * (recharts can't draw a line from a single sample).
 */

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Adapter, TimeRange } from './adapters/types';
import { bucketColor } from './adapters/types';
import { TimeRangePicker } from './TimeRangePicker';

interface Props<Row> {
  adapter: Adapter<Row>;
  rows: Row[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  paused?: boolean;
  onTogglePause?: () => void;
  range?: TimeRange;
  onRangeChange?: (range: TimeRange | undefined) => void;
}

type Granularity = 'minute' | 'hour' | 'day';

interface HistogramPoint {
  /** Display label for the X axis (e.g. "13h", "12:34", "May 27"). */
  label: string;
  /** Slot start as ms-since-epoch — used by the tooltip + sort + ticks. */
  t: number;
  /** One numeric key per bucket, count of rows in this slot. */
  [bucket: string]: string | number;
}

interface HistogramResult {
  points: HistogramPoint[];
  buckets: string[];
  granularity: Granularity;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function pickGranularity(spanMs: number): Granularity {
  if (spanMs < 3 * HOUR_MS) return 'minute';
  if (spanMs < 7 * DAY_MS) return 'hour';
  return 'day';
}

function floorSlot(d: Date, g: Granularity): Date {
  switch (g) {
    case 'minute': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
    case 'hour':   return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
    case 'day':    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

function stepMs(g: Granularity): number {
  return g === 'minute' ? 60_000 : g === 'hour' ? HOUR_MS : DAY_MS;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatAxisLabel(d: Date, g: Granularity): string {
  switch (g) {
    case 'minute': return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    case 'hour':   return `${pad(d.getHours())}h`;
    case 'day':    return d.toLocaleDateString([], { month: 'short', day: '2-digit' });
  }
}

function formatTooltipLabel(t: number, g: Granularity): string {
  const d = new Date(t);
  switch (g) {
    case 'minute':
      return d.toLocaleString([], { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    case 'hour':
      return d.toLocaleString([], { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit' }) + 'h';
    case 'day':
      return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' });
  }
}

/**
 * Build a recharts-friendly histogram from row timestamps. Slots
 * between the earliest and latest sample are filled with explicit
 * zeros for every bucket so the line stays continuous across empty
 * regions instead of jumping.
 */
function buildHistogram<Row>(
  rows: Row[],
  project: (row: Row) => { time: string; bucket: string } | null,
): HistogramResult {
  const stamped: Array<{ t: number; bucket: string }> = [];
  const bucketSet = new Set<string>();
  for (const row of rows) {
    const p = project(row);
    if (!p) continue;
    const t = new Date(p.time);
    if (Number.isNaN(t.getTime())) continue;
    stamped.push({ t: t.getTime(), bucket: p.bucket });
    bucketSet.add(p.bucket);
  }
  if (stamped.length === 0) {
    return { points: [], buckets: [], granularity: 'hour' };
  }
  let tMin = Number.POSITIVE_INFINITY;
  let tMax = Number.NEGATIVE_INFINITY;
  for (const s of stamped) {
    if (s.t < tMin) tMin = s.t;
    if (s.t > tMax) tMax = s.t;
  }
  const granularity = pickGranularity(tMax - tMin);
  const step = stepMs(granularity);
  const buckets = Array.from(bucketSet);

  // Pre-allocate every slot in [floor(tMin), floor(tMax)] so the line
  // joins across zero-activity windows. Capped at 500 slots to keep
  // recharts responsive on extreme ranges (a long span automatically
  // picks `day`, so 500 days is already 1.3 years).
  const startSlot = floorSlot(new Date(tMin), granularity).getTime();
  const endSlot = floorSlot(new Date(tMax), granularity).getTime();
  const slotCount = Math.floor((endSlot - startSlot) / step) + 1;
  const SAFETY_CAP = 500;
  const effectiveStep = slotCount > SAFETY_CAP
    ? step * Math.ceil(slotCount / SAFETY_CAP)
    : step;
  const byT = new Map<number, HistogramPoint>();
  for (let cur = startSlot; cur <= endSlot; cur += effectiveStep) {
    const point: HistogramPoint = { label: formatAxisLabel(new Date(cur), granularity), t: cur };
    for (const b of buckets) point[b] = 0;
    byT.set(cur, point);
  }
  // Bucket assignment — find the largest slot <= s.t.
  for (const s of stamped) {
    const slot = startSlot + Math.floor((s.t - startSlot) / effectiveStep) * effectiveStep;
    const point = byT.get(slot);
    if (point) point[s.bucket] = ((point[s.bucket] as number) ?? 0) + 1;
  }
  const points = Array.from(byT.values()).sort((a, b) => (a.t as number) - (b.t as number));
  return { points, buckets, granularity };
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
  range,
  onRangeChange,
}: Props<Row>) {
  const { points, buckets, granularity } = useMemo<HistogramResult>(() => {
    if (!adapter.histogramOf) return { points: [], buckets: [], granularity: 'hour' };
    return buildHistogram(rows, adapter.histogramOf);
  }, [rows, adapter]);

  const orderedBuckets = useMemo(
    () =>
      KNOWN_ORDER.filter((b) => buckets.includes(b)).concat(
        buckets.filter((b) => !KNOWN_ORDER.includes(b)),
      ),
    [buckets],
  );

  // Reduce X-axis labels when we have many slots — recharts default
  // crams them and they overlap. ~12 ticks reads well across the
  // 1100-1400px main column on a typical desktop.
  const tickInterval = useMemo(() => {
    if (points.length <= 12) return 0;
    return Math.max(0, Math.floor(points.length / 12) - 1);
  }, [points.length]);

  // With very few data points recharts cannot render a line (1 sample
  // = no segment). Switching to visible dots makes a 1-2 point dataset
  // readable; with denser data we drop them to avoid noise.
  const showDots = points.length <= 5;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="h-64 px-3 pt-2 pb-1">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="var(--text-muted)"
                interval={tickInterval}
                minTickGap={8}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--text-muted)"
                width={32}
                allowDecimals={false}
              />
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
                labelFormatter={(_label: string, payload) => {
                  if (Array.isArray(payload) && payload.length > 0 && payload[0]?.payload) {
                    const t = (payload[0].payload as HistogramPoint).t as number;
                    if (typeof t === 'number') return formatTooltipLabel(t, granularity);
                  }
                  return _label;
                }}
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
                  dot={showDots ? { r: 3, fill: bucketColor(b), stroke: bucketColor(b) } : false}
                  activeDot={{ r: 4 }}
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
        {onRangeChange && (
          <TimeRangePicker range={range} onChange={onRangeChange} />
        )}
      </div>
    </div>
  );
}

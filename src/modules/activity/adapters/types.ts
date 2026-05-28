/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Generic Adapter contract for Activity Center tabs.
 *
 * Each tab implements one Adapter<Row> describing:
 *   - how to fetch a snapshot for the table
 *   - what columns to render
 *   - how to subscribe (if any) to a live WS stream
 *   - which filter facets are useful (severity, level, stream, etc.)
 *
 * The generic ActivityModule shell + ActivityTable consume Adapter
 * without knowing what a Row looks like, so adding a new tab just
 * means implementing one of these in the tabs/ folder.
 */

import type { ReactNode } from 'react';

export interface AdapterFilter {
  /** machine name (eg "severity") */
  key: string;
  label: string;
  /** ordered option list — first option is implicitly "all" */
  options: Array<{ value: string; label: string }>;
}

export interface AdapterColumn<Row> {
  key: string;
  label: string;
  /** Tailwind width class (e.g. "w-40") or undefined for flex-1 */
  width?: string;
  render: (row: Row) => ReactNode;
}

export interface TimeRange {
  /** ISO timestamp lower bound (inclusive). */
  from: string;
  /** ISO timestamp upper bound (exclusive). */
  to: string;
}

export interface AdapterFetchParams {
  filters: Record<string, string>;
  search: string;
  limit: number;
  /**
   * Optional time-range filter. When set, adapters MUST pass `from`/`to`
   * to their underlying endpoint so the snapshot includes older rows
   * that fall inside the range (the default tail-by-bytes won't reach
   * them). Without a range, adapters use their usual default window.
   */
  range?: TimeRange;
}

export interface AdapterFetchResult<Row> {
  rows: Row[];
  /** total bytes used by the bucket backing this tab, if known */
  bucketBytes?: number;
  /** total cap for the bucket in bytes */
  bucketCapBytes?: number;
  /** unused — reserved for cursor-based pagination */
  cursor?: string | null;
}

export interface Adapter<Row> {
  tabKey: 'events' | 'notifications' | 'gateway' | 'containers' | 'core';
  title: string;
  /** Lucide icon component (rendered by the shell sidebar) */
  iconLabel: string; // emoji or 1-letter; kept stringly to avoid pulling icons here
  /** Filter facets exposed by this tab */
  filters: AdapterFilter[];
  /** Column descriptors for the table */
  columns: AdapterColumn<Row>[];
  /** Fetch a snapshot. Adapters can choose to also wire a WS subscription. */
  fetchSnapshot(params: AdapterFetchParams): Promise<AdapterFetchResult<Row>>;
  /** Render the right drawer detail when a row is clicked. */
  renderDetail(row: Row): ReactNode;
  /** Optional row key extractor (default falls back to index). */
  getRowKey?(row: Row): string;
  /**
   * Client-side filter predicate. Applied AFTER fetchSnapshot AND on
   * each live-WS row, so the result matches the user's current filter
   * even when the snapshot was loaded before the filter changed and
   * the WS keeps pushing unfiltered rows. Returns true to keep.
   */
  matchesFilters?(row: Row, filters: Record<string, string>): boolean;
  /**
   * Project a row to the histogram axes (time, plus a categorical
   * bucket — severity / log level / docker stream / etc.).
   * When defined, ActivityHeader plots one line per bucket derived
   * from the tab's CURRENT rows, so each tab gets its own histogram
   * that mirrors the rendered table (and reacts to filters / live
   * inserts). Return null to skip a row.
   */
  histogramOf?(row: Row): { time: string; bucket: string } | null;
}

/**
 * Severity colour palette shared by every adapter — keeps the
 * histogram + the row pills consistent.
 */
export const SEVERITY_COLORS: Record<string, string> = {
  debug:    '#94a3b8', // slate-400
  info:     '#3b82f6', // blue-500
  warn:     '#f59e0b', // amber-500
  error:    '#ef4444', // red-500
  critical: '#b91c1c', // red-700
  trace:    '#cbd5e1', // slate-300
  fatal:    '#991b1b', // red-800
};

export function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity.toLowerCase()] ?? '#64748b';
}

/**
 * Palette for non-severity categorical histogram axes (Docker streams,
 * notification rule keys, etc.). Falls back to severity colours so
 * tabs that bucket by level reuse the same palette.
 */
export const BUCKET_COLORS: Record<string, string> = {
  stdout: '#94a3b8',
  stderr: '#ef4444',
};

export function bucketColor(bucket: string): string {
  const lower = bucket.toLowerCase();
  return SEVERITY_COLORS[lower] ?? BUCKET_COLORS[lower] ?? '#64748b';
}

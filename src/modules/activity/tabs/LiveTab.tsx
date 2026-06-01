/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Live tab (E3) — ephemeral, browser-local rolling list of tool calls
 * happening NOW across all the user's conversations. Fed entirely by
 * the WS event `activity.tool` (no DB snapshot). Resets on page reload.
 *
 * Same principle as OpenClaw upstream Activity tab (5.26): sanitized
 * summaries, no persistence, lightweight.
 */

import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { liveAdapter, transformActivityToolEvent } from '../adapters/live.adapter';
import type { LiveToolRow } from '../adapters/live.adapter';
import type { ActivityStats } from '@/services/activity.service';
import type { TimeRange } from '../adapters/types';

interface Props {
  stats: ActivityStats | null;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  paused: boolean;
  onTogglePause: () => void;
  range?: TimeRange;
  onRangeChange: (range: TimeRange | undefined) => void;
}

export function LiveTab({
  filters,
  onFilterChange,
  search,
  onSearchChange,
  paused,
  onTogglePause,
  range,
  onRangeChange,
}: Props) {
  const { filteredRows, loading } = useActivityRows<LiveToolRow>({
    adapter: liveAdapter,
    filters,
    search,
    paused,
    range,
    ws: {
      pattern: 'activity.tool',
      transform: transformActivityToolEvent,
      timestampOf: (row) => row.started_at,
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={liveAdapter}
        rows={filteredRows}
        filters={filters}
        onFilterChange={onFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        paused={paused}
        onTogglePause={onTogglePause}
        range={range}
        onRangeChange={onRangeChange}
      />
      {filteredRows.length === 0 && !loading ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
          <div className="text-center">
            <div className="mb-2">No active tool calls right now.</div>
            <div className="text-xs">
              Start a chat with an agent — tool calls from any of your
              conversations appear here in real time.
            </div>
          </div>
        </div>
      ) : (
        <ActivityTable<LiveToolRow> adapter={liveAdapter} rows={filteredRows} loading={loading} />
      )}
    </div>
  );
}

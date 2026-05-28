/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * System (Core) logs tab — pino NDJSON tail. Initial paint via
 * GET /core/logs, live append via `core.logs.entry` WS.
 */

import { useEffect } from 'react';
import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { coreLogsAdapter } from '../adapters/core-logs.adapter';
import type { TimeRange } from '../adapters/types';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { CoreLogEntry, ActivityStats } from '@/services/activity.service';
import type { WsEvent } from '@/types/websocket';

function wsToRow(event: WsEvent): CoreLogEntry | null {
  if (event.event !== 'core.logs.entry' || !event.data) return null;
  const data = event.data as unknown as CoreLogEntry;
  if (typeof data.message !== 'string') return null;
  return data;
}

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

export function CoreLogsTab(props: Props) {
  const wsStatus = useWebSocketStore((s) => s.status);
  const wsSend = useWebSocketStore((s) => s.send);

  useEffect(() => {
    if (wsStatus !== 'connected') return;
    wsSend('core.logs.subscribe');
    return () => {
      wsSend('core.logs.unsubscribe');
    };
  }, [wsStatus, wsSend]);

  const { filteredRows, loading } = useActivityRows<CoreLogEntry>({
    adapter: coreLogsAdapter,
    filters: props.filters,
    search: props.search,
    paused: props.paused,
    range: props.range,
    ws: {
      pattern: 'core.logs.entry',
      transform: wsToRow,
      timestampOf: (row) => row.timestamp,
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={coreLogsAdapter}
        rows={filteredRows}
        filters={props.filters}
        onFilterChange={props.onFilterChange}
        search={props.search}
        onSearchChange={props.onSearchChange}
        paused={props.paused}
        onTogglePause={props.onTogglePause}
        range={props.range}
        onRangeChange={props.onRangeChange}
      />
      <ActivityTable<CoreLogEntry>
        adapter={coreLogsAdapter}
        rows={filteredRows}
        loading={loading}
      />
    </div>
  );
}

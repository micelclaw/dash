/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Gateway logs tab — initial paint via GET /gateway/logs, then live
 * append from the `gateway.logs.entry` WS topic. The WS subscribe/
 * unsubscribe ack is sent on the channel directly (the broadcaster
 * spins up the tail on first subscriber, stops on the last).
 */

import { useEffect } from 'react';
import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { gatewayLogsAdapter } from '../adapters/gateway-logs.adapter';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { GatewayLogEntry, ActivityStats } from '@/services/activity.service';
import type { WsEvent } from '@/types/websocket';

function wsToRow(event: WsEvent): GatewayLogEntry | null {
  if (event.event !== 'gateway.logs.entry' || !event.data) return null;
  const data = event.data as unknown as GatewayLogEntry;
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
}

export function GatewayLogsTab(props: Props) {
  const wsStatus = useWebSocketStore((s) => s.status);
  const wsSend = useWebSocketStore((s) => s.send);

  // Tell the broadcaster we want the gateway log tail (idempotent).
  useEffect(() => {
    if (wsStatus !== 'connected') return;
    wsSend('gateway.logs.subscribe');
    return () => {
      wsSend('gateway.logs.unsubscribe');
    };
  }, [wsStatus, wsSend]);

  const { filteredRows, loading } = useActivityRows<GatewayLogEntry>({
    adapter: gatewayLogsAdapter,
    filters: props.filters,
    search: props.search,
    paused: props.paused,
    ws: {
      pattern: 'gateway.logs.entry',
      transform: wsToRow,
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={gatewayLogsAdapter}
        stats={props.stats}
        filters={props.filters}
        onFilterChange={props.onFilterChange}
        search={props.search}
        onSearchChange={props.onSearchChange}
        paused={props.paused}
        onTogglePause={props.onTogglePause}
      />
      <ActivityTable<GatewayLogEntry>
        adapter={gatewayLogsAdapter}
        rows={filteredRows}
        loading={loading}
      />
    </div>
  );
}

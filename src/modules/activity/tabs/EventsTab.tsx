/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Events tab — feed of ClawEventBus events with live append from the
 * `agent.event` WS topic.
 */

import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { eventsAdapter } from '../adapters/events.adapter';
import type { TimeRange } from '../adapters/types';
import type { AgentEventRow } from '@/services/activity.service';
import type { ActivityStats } from '@/services/activity.service';
import type { WsEvent } from '@/types/websocket';

interface AgentEventWsPayload {
  id: string;
  type: string;
  severity?: string;
  schema_version?: number;
  source?: string | null;
  target?: string | null;
  payload?: Record<string, unknown>;
  timestamp?: string;
  user_id?: string | null;
}

function wsToRow(event: WsEvent): AgentEventRow | null {
  if (event.event !== 'agent.event' || !event.data) return null;
  const data = event.data as unknown as AgentEventWsPayload;
  if (!data.id || !data.type) return null;
  return {
    id: data.id,
    type: data.type,
    severity: data.severity ?? 'info',
    schema_version: data.schema_version ?? 1,
    source_agent_id: null, // WS payload carries names, not ids
    target_agent_id: null,
    user_id: data.user_id ?? null,
    payload: data.payload ?? {},
    processed: false,
    created_at: data.timestamp ?? new Date().toISOString(),
  };
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

export function EventsTab({ filters, onFilterChange, search, onSearchChange, paused, onTogglePause, range, onRangeChange }: Props) {
  const { filteredRows, loading } = useActivityRows<AgentEventRow>({
    adapter: eventsAdapter,
    filters,
    search,
    paused,
    range,
    ws: {
      pattern: 'agent.event',
      transform: wsToRow,
      timestampOf: (row) => row.created_at,
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={eventsAdapter}
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
      <ActivityTable<AgentEventRow>
        adapter={eventsAdapter}
        rows={filteredRows}
        loading={loading}
      />
    </div>
  );
}

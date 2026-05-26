/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Notifications tab — approximate history of dispatched pushes,
 * sourced from `/activity/notifications-history`. Live updates piggy-
 * back on `notification.new` WS frames (the same the bell consumes).
 */

import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { notificationsAdapter } from '../adapters/notifications.adapter';
import type { NotificationHistoryRow } from '@/services/activity.service';
import type { ActivityStats } from '@/services/activity.service';
import type { WsEvent } from '@/types/websocket';

interface NotificationWsPayload {
  source_event_id?: string;
  source_event_type?: string;
  template?: string;
  title?: string;
  severity?: string;
  ts?: string;
}

function wsToRow(event: WsEvent): NotificationHistoryRow | null {
  if (event.event !== 'notification.new' || !event.data) return null;
  const data = event.data as unknown as NotificationWsPayload;
  if (!data.source_event_id || !data.source_event_type) return null;
  // We re-use the source event id as the row id so it dedupes with
  // the REST snapshot that will eventually load the same id.
  return {
    id: data.source_event_id,
    type: data.source_event_type,
    severity: data.severity ?? 'info',
    user_id: null,
    payload: { template: data.template, title: data.title },
    created_at: data.ts ?? new Date().toISOString(),
    rule_key: data.template ?? null,
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
}

export function NotificationsTab({ stats, filters, onFilterChange, search, onSearchChange, paused, onTogglePause }: Props) {
  const { filteredRows, loading } = useActivityRows<NotificationHistoryRow>({
    adapter: notificationsAdapter,
    filters,
    search,
    paused,
    ws: {
      pattern: 'notification.new',
      transform: wsToRow,
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={notificationsAdapter}
        stats={stats}
        filters={filters}
        onFilterChange={onFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        paused={paused}
        onTogglePause={onTogglePause}
      />
      <ActivityTable<NotificationHistoryRow>
        adapter={notificationsAdapter}
        rows={filteredRows}
        loading={loading}
      />
    </div>
  );
}

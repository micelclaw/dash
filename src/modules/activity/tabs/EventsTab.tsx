/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Events tab — feed of ClawEventBus events with live append from the
 * `agent.event` WS topic.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import { eventsAdapter } from '../adapters/events.adapter';
import type { TimeRange } from '../adapters/types';
import { getAgentEventBusStats, type AgentEventBusStats, type AgentEventRow } from '@/services/activity.service';
import type { ActivityStats } from '@/services/activity.service';
import type { WsEvent } from '@/types/websocket';
import { eventStatsSections, shouldFetchEventStats } from '../event-stats-view';

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
  const [statsOpen, setStatsOpen] = useState(false);
  const [busStats, setBusStats] = useState<AgentEventBusStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try { setBusStats(await getAgentEventBusStats()); }
    catch { setStatsError('Statistics are unavailable for this account.'); }
    finally { setStatsLoading(false); }
  };
  useEffect(() => { if (shouldFetchEventStats(statsOpen, !!busStats)) void loadStats(); }, [statsOpen, busStats]);
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
      <section style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
          <button type="button" onClick={() => setStatsOpen((open) => !open)} aria-expanded={statsOpen} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
            {statsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Process statistics
          </button>
          {statsOpen && <button type="button" onClick={() => void loadStats()} title="Refresh statistics" aria-label="Refresh statistics" style={{ display: 'flex', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} /></button>}
          {statsOpen && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Resets when Core restarts.</span>}
        </div>
        {statsOpen && busStats && <EventStatsSummary stats={busStats} />}
        {statsOpen && statsError && <div role="status" style={{ padding: '0 16px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{statsError}</div>}
      </section>
      <ActivityTable<AgentEventRow>
        adapter={eventsAdapter}
        rows={filteredRows}
        loading={loading}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}><div style={{ color: 'var(--text-muted)' }}>{label}</div><div style={{ color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{value}</div></div>;
}

export function EventStatsSummary({ stats }: { stats: AgentEventBusStats }) {
  const sections = eventStatsSections(stats);
  return <div style={{ display: 'grid', gap: 10, padding: '0 16px 12px', fontSize: '0.75rem' }}>
    <StatsSection label="Since this Core started" rows={sections.sinceStart} />
    <StatsSection label="Persistent backlog" rows={sections.backlog} />
  </div>;
}

function StatsSection({ label, rows }: { label: string; rows: Array<[string, string | number]> }) {
  return <section aria-label={label}><div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 5 }}>{label}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>{rows.map(([name, value]) => <Stat key={name} label={name} value={value} />)}</div></section>;
}

/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Live feed of the ClawEventBus (SP8-2 Sesión 4). Initial load comes from
// `GET /agent-events`; live append from the `agent.events.entry` WS topic.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Pause, Play, Filter } from 'lucide-react';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import type { ManagedAgent } from '../types';

interface AgentEvent {
  id: string;
  type: string;
  source_agent_id: string | null;
  target_agent_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

// WS payload from `agent.event` carries agent NAMES in source/target (not ids).
interface AgentEventWsPayload {
  id: string;
  type: string;
  source: string;
  target: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

const TYPE_GROUPS = [
  { value: 'all', label: 'All types' },
  { value: 'agent.task.', label: 'Tasks' },
  { value: 'agent.delegation.', label: 'Delegations' },
  { value: 'agent.verification.', label: 'Verifications' },
  { value: 'workflow.', label: 'Workflows' },
];

const RANGES = [
  { value: '15m', label: 'Last 15 min' },
  { value: '1h', label: 'Last 1 h' },
  { value: '24h', label: 'Last 24 h' },
  { value: '7d', label: 'Last 7 d' },
];

function rangeToSince(range: string): Date {
  const now = Date.now();
  switch (range) {
    case '15m': return new Date(now - 15 * 60_000);
    case '1h':  return new Date(now - 60 * 60_000);
    case '24h': return new Date(now - 24 * 60 * 60_000);
    case '7d':  return new Date(now - 7 * 24 * 60 * 60_000);
    default:    return new Date(now - 60 * 60_000);
  }
}

interface EventsTabProps {
  agents: ManagedAgent[];
}

export function EventsTab({ agents }: EventsTabProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [rangeFilter, setRangeFilter] = useState<string>('1h');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);

  // Build a per-id and per-name lookup
  const agentByIdLookup = useMemo(() => {
    const m = new Map<string, ManagedAgent>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);
  const agentByNameLookup = useMemo(() => {
    const m = new Map<string, ManagedAgent>();
    for (const a of agents) m.set(a.name, a);
    return m;
  }, [agents]);

  // Initial load + reload on filter change. The backend supports `type`
  // glob and `limit` only — `since` and source filters are applied
  // client-side after fetching the recent page.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '200' });
        if (typeFilter !== 'all') params.set('type', `${typeFilter}*`);
        const res = await api.get<{ data: { events: AgentEvent[]; count: number; has_more: boolean } }>(`/agent-events?${params}`);
        if (!cancelled) {
          const sinceTs = rangeToSince(rangeFilter).getTime();
          const filtered = res.data.events.filter(e => {
            const t = new Date(e.created_at).getTime();
            if (t < sinceTs) return false;
            if (agentFilter !== 'all' && e.source_agent_id !== agentFilter) return false;
            return true;
          });
          setEvents(filtered);
          setPendingCount(0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [typeFilter, agentFilter, rangeFilter]);

  // Live append via WS. The backend emits `agent.event` (singular) with
  // `source` and `target` carrying agent NAMES — translate to the
  // id-based shape we render.
  const liveEvent = useWebSocket('agent.event');

  useEffect(() => {
    if (!liveEvent) return;
    const ev = liveEvent.data as AgentEventWsPayload | undefined;
    if (!ev || !ev.id) return;
    if (typeFilter !== 'all' && !ev.type.startsWith(typeFilter)) return;
    const sourceAgent = agentByNameLookup.get(ev.source);
    const targetAgent = ev.target ? agentByNameLookup.get(ev.target) : null;
    if (agentFilter !== 'all' && sourceAgent?.id !== agentFilter) return;
    if (paused) {
      setPendingCount(c => c + 1);
      return;
    }
    const normalized: AgentEvent = {
      id: ev.id,
      type: ev.type,
      source_agent_id: sourceAgent?.id ?? null,
      target_agent_id: targetAgent?.id ?? null,
      payload: ev.payload,
      processed: false,
      created_at: ev.timestamp,
    };
    setEvents(prev => {
      if (prev.some(e => e.id === normalized.id)) return prev;
      return [normalized, ...prev].slice(0, 500);
    });
  }, [liveEvent, typeFilter, agentFilter, agentByNameLookup, paused]);

  const handleResume = useCallback(() => {
    setPaused(false);
    setPendingCount(0);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={TYPE_GROUPS} />
        <FilterSelect
          value={agentFilter}
          onChange={setAgentFilter}
          options={[{ value: 'all', label: 'All agents' }, ...agents.map(a => ({ value: a.id, label: a.display_name }))]}
        />
        <FilterSelect value={rangeFilter} onChange={setRangeFilter} options={RANGES} />

        <div style={{ flex: 1 }} />

        <button
          onClick={paused ? handleResume : () => setPaused(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: paused ? 'var(--amber-dim)' : 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: paused ? 'var(--amber)' : 'var(--text-dim)',
            fontSize: '0.75rem', fontWeight: 500, padding: '4px 10px',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            transition: 'var(--transition-fast)',
          }}
        >
          {paused ? <><Play size={12} fill="currentColor" /> Resume {pendingCount > 0 && <>({pendingCount})</>}</> : <><Pause size={12} /> Pause</>}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
            Loading events…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--error)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No events in the selected window.
          </div>
        )}
        {!loading && !error && events.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th>Source</Th>
                <Th>Target</Th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <EventRow
                  key={e.id}
                  ev={e}
                  expanded={expanded.has(e.id)}
                  onToggle={() => toggleExpanded(e.id)}
                  agentLookup={agentByIdLookup}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)',
        fontSize: '0.75rem', padding: '4px 8px', fontFamily: 'var(--font-sans)',
        cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 12px',
      fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
      borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{children}</th>
  );
}

function EventRow({
  ev, expanded, onToggle, agentLookup,
}: {
  ev: AgentEvent;
  expanded: boolean;
  onToggle: () => void;
  agentLookup: Map<string, ManagedAgent>;
}) {
  const sourceName = ev.source_agent_id ? agentLookup.get(ev.source_agent_id)?.display_name ?? ev.source_agent_id.slice(0, 8) : '—';
  const targetName = ev.target_agent_id ? agentLookup.get(ev.target_agent_id)?.display_name ?? ev.target_agent_id.slice(0, 8) : '—';
  const time = new Date(ev.created_at).toLocaleTimeString();
  const color = ev.type.includes('failed') ? 'var(--error)'
    : ev.type.includes('completed') || ev.type.includes('success') ? 'var(--success)'
    : 'var(--text)';

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: expanded ? 'var(--surface-hover)' : 'transparent',
          transition: 'var(--transition-fast)',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--surface)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <Td><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{time}</span></Td>
        <Td><span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{ev.type}</span></Td>
        <Td>{sourceName}</Td>
        <Td>{targetName}</Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{
            padding: '0 16px 12px',
            background: 'var(--surface-hover)',
          }}>
            <pre style={{
              margin: 0,
              padding: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {JSON.stringify(ev.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: '8px 12px', borderBottom: '1px solid var(--border)',
      verticalAlign: 'top', color: 'var(--text)',
    }}>{children}</td>
  );
}

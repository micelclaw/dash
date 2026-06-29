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

import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { severityColor } from '@/modules/activity/adapters/types';
import { AgentSelect } from './AgentSelect';
import { useAgentEvents } from './hooks/use-agent-events';
import { formatRelativeTime } from './shared/format';
import type { AgentEventRow } from './types';

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'critical', label: 'Critical' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

export function EventTimeline({ agentId }: { agentId: string }) {
  const [severity, setSeverity] = useState('all');
  const { events, loading, loadingMore, error, hasMore, loadMore } = useAgentEvents(agentId, severity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Timeline de eventos
        </span>
        <div style={{ minWidth: 120 }}>
          <AgentSelect value={severity} options={SEVERITY_OPTIONS} onChange={setSeverity} minWidth={120} />
        </div>
      </div>

      {error && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--error)' }}>{error}</span>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 26, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, padding: '4px 2px' }}>
          Este agente todavía no tiene eventos propios. Los eventos del sistema (login, errores,
          workflows) se registran a nivel global en{' '}
          <a href="/activity" style={{ color: 'var(--amber)' }}>Activity Center</a>.
        </div>
      )}

      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {events.map((e) => <EventRow key={e.id} ev={e} />)}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                alignSelf: 'center', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-dim)', fontSize: '0.6875rem', padding: '4px 10px',
                cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {loadingMore && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: AgentEventRow }) {
  const [open, setOpen] = useState(false);
  const color = severityColor(ev.severity);
  const hasPayload = ev.payload && Object.keys(ev.payload).length > 0;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px' }}>
      <div
        onClick={() => hasPayload && setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: hasPayload ? 'pointer' : 'default' }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text)', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.type}
        </span>
        <span title={ev.direction === 'out' ? 'saliente' : 'entrante'} style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
          {ev.direction === 'out' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
        </span>
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: 64, textAlign: 'right' }}>
          {formatRelativeTime(ev.created_at)}
        </span>
        {hasPayload ? (open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />) : <span style={{ width: 12 }} />}
      </div>
      {open && hasPayload && (
        <pre style={{
          margin: '6px 0 2px', padding: '6px 8px', background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', fontSize: '0.625rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(ev.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

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

import { useId, useMemo } from 'react';
import { Link } from 'react-router';
import { createPortal } from 'react-dom';
import { BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAgentConversations } from './hooks/use-agent-conversations';
import { ConversationMessage } from './ConversationMessage';
import { ConversationCharts } from './ConversationCharts';
import type { ManagedAgent } from './types';

interface AgentConversationsProps {
  agents: ManagedAgent[];
  headerActions: HTMLDivElement | null;
  searchParams: URLSearchParams;
  onPreferenceChange: (key: 'agents_period' | 'agents_participant' | 'agents_charts' | 'agents_query', value: string) => void;
}

const PERIOD_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
] as const;

function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null) return '—';
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  return tokens.toLocaleString();
}

function formatPeriodLabel(period: string): string {
  const match = PERIOD_OPTIONS.find(p => p.value === period);
  return match ? match.label : period;
}

export function AgentConversations({ agents, headerActions, searchParams, onPreferenceChange }: AgentConversationsProps) {
  const periodId = useId();
  const agentId = useId();
  const selectedPeriod = searchParams.get('agents_period');
  const period = PERIOD_OPTIONS.find(option => option.value === selectedPeriod)?.value ?? 'month';
  const selectedAgent = searchParams.get('agents_participant');
  const agentFilter = agents.find(agent => agent.name === selectedAgent)?.name ?? '';
  const showCharts = searchParams.get('agents_charts') !== '0';
  const query = (searchParams.get('agents_query') ?? '').slice(0, 120).trim();


  const { conversations, stats, loading, failed, retry } = useAgentConversations({
    period,
    agent: agentFilter || undefined,
    query,
  });

  // Group conversations by session_id
  const grouped = useMemo(() => {
    const map = new Map<string, typeof conversations>();
    for (const conv of conversations) {
      const existing = map.get(conv.session_id);
      if (existing) {
        existing.push(conv);
      } else {
        map.set(conv.session_id, [conv]);
      }
    }
    return map;
  }, [conversations]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {headerActions && createPortal(<>
        <form role="search" className="flex max-w-full min-w-0 items-center gap-1" onSubmit={event => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('query');
          if (typeof value === 'string') onPreferenceChange('agents_query', value.trim());
        }}>
          <Input key={query} name="query" type="search" aria-label="Buscar intercambios" defaultValue={query}
            maxLength={120} className="h-7 min-w-0 w-32" />
          <Button type="submit" size="sm" variant="outline" className="h-7">Buscar</Button>
        </form>
        <button
          type="button"
          aria-pressed={showCharts}
          onClick={() => onPreferenceChange('agents_charts', showCharts ? '0' : '')}
          title={showCharts ? 'Ocultar gráficas' : 'Mostrar gráficas'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: showCharts ? 'var(--surface-hover)' : 'var(--surface)',
            border: showCharts ? '1px solid var(--amber)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: showCharts ? 'var(--amber)' : 'var(--text-dim)',
            fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <BarChart3 size={13} /> Gráficas
        </button>
        <label htmlFor={periodId} className="text-xs text-muted-foreground">Period</label>
        <select
          id={periodId}
          value={period}
          onChange={e => onPreferenceChange('agents_period', e.target.value)}
          style={selectStyle}
        >
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <label htmlFor={agentId} className="text-xs text-muted-foreground">Agent</label>
        <select
          id={agentId}
          value={agentFilter}
          onChange={e => onPreferenceChange('agents_participant', e.target.value)}
          style={selectStyle}
        >
          <option value="">All</option>
          {agents.map(a => (
            <option key={a.id} value={a.name}>{a.display_name}</option>
          ))}
        </select>
      </>, headerActions)}

      {/* Charts panel (recharts) */}
      {showCharts && stats && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <ConversationCharts stats={stats} agents={agents} />
        </div>
      )}

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px',
      }}>
        {loading && (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
          }}>
            Loading conversations...
          </div>
        )}

        {failed && (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            No se pudieron cargar las conversaciones de este filtro.
            <button type="button" className="underline" onClick={retry}>Reintentar</button>
          </div>
        )}

        {!loading && !failed && conversations.length === 0 && (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
          }}>
            {query ? 'No hay intercambios que coincidan con la búsqueda.' : 'No conversations found for this period.'}
          </div>
        )}

        {!loading && Array.from(grouped.entries()).map(([sessionId, messages]) => {
          const conversationId = messages[0]?.conversation_id;
          const hasConversation = !!conversationId &&
            /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(conversationId) &&
            messages.every(message => message.conversation_id === conversationId);
          const firstTime = messages[0]
            ? new Date(messages[0].created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';
          const sessionLabel = `Session ${sessionId ?? '—'} · ${firstTime}`;

          return (
            <div key={sessionId}>
              {/* Session header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 0 8px',
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                }}>
                  {hasConversation
                    ? <Link className="underline" to={`/chat?conversation=${encodeURIComponent(conversationId)}`}>{sessionLabel}</Link>
                    : sessionLabel}
                </div>
                <div style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border)',
                }} />
              </div>

              {/* Messages in session */}
              {messages.map(msg => (
                <ConversationMessage
                  key={msg.id}
                  message={msg}
                  agents={agents}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          borderTop: '1px solid var(--border)',
          padding: '8px 16px',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
          }}>
            📊 {formatPeriodLabel(period)}: {(stats.total_messages ?? 0).toLocaleString()} messages &middot;{' '}
            {formatTokens(stats.total_tokens)} tokens &middot; ${(stats.total_cost_usd ?? 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

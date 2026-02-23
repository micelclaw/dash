import { useState, useMemo } from 'react';
import { useAgentConversations } from './hooks/use-agent-conversations';
import { ConversationMessage } from './ConversationMessage';
import type { ManagedAgent } from './types';

interface AgentConversationsProps {
  agents: ManagedAgent[];
}

const PERIOD_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
] as const;

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  return tokens.toLocaleString();
}

function formatPeriodLabel(period: string): string {
  const match = PERIOD_OPTIONS.find(p => p.value === period);
  return match ? match.label : period;
}

export function AgentConversations({ agents }: AgentConversationsProps) {
  const [period, setPeriod] = useState('today');
  const [agentFilter, setAgentFilter] = useState('');

  const { conversations, stats, loading } = useAgentConversations({
    period,
    agent: agentFilter || undefined,
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
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap' as const,
        gap: 8,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text)',
        }}>
          Conversations
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Period:
          </label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={selectStyle}
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Agent:
          </label>
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All</option>
            {agents.map(a => (
              <option key={a.id} value={a.name}>{a.display_name}</option>
            ))}
          </select>
        </div>
      </div>

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

        {!loading && conversations.length === 0 && (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
          }}>
            No conversations found for this period.
          </div>
        )}

        {!loading && Array.from(grouped.entries()).map(([sessionId, messages]) => {
          const firstTime = messages[0]
            ? new Date(messages[0].created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

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
                  whiteSpace: 'nowrap',
                }}>
                  Session {sessionId} &middot; {firstTime}
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
            📊 {formatPeriodLabel(period)}: {stats.total_messages.toLocaleString()} messages &middot;{' '}
            {formatTokens(stats.total_tokens)} tokens &middot; ${stats.total_cost_usd.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

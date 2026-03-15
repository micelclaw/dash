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

import { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Bot, Clock, Cpu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SessionsTab() {
  const isMobile = useIsMobile();
  const { sessions, sessionsLoading, sessionsError, fetchSessions } = useGatewayStore();
  const [refreshHover, setRefreshHover] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) fetchSessions();
    // Auto-refresh every 30s
    const interval = setInterval(() => fetchSessions(), 30_000);
    return () => clearInterval(interval);
  }, [sessions.length, fetchSessions]);

  if (sessionsLoading && sessions.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading sessions...
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {sessionsError}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
          }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => fetchSessions()}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            style={{
              background: refreshHover ? 'var(--surface-hover)' : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              transition: 'var(--transition-fast)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {sessions.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <MessageSquare size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              No active sessions
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: isMobile ? 'wrap' : undefined,
                }}
              >
                {/* Agent icon */}
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-sm)',
                  background: '#8b5cf615',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Bot size={16} style={{ color: '#8b5cf6' }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: 500,
                      color: 'var(--text)', fontFamily: 'var(--font-sans)',
                    }}>
                      {session.agent || 'main'}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-sans)',
                      textTransform: 'capitalize',
                    }}>
                      {session.kind}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: '0.75rem', color: 'var(--text-dim)',
                    fontFamily: 'var(--font-sans)', marginTop: 2,
                  }}>
                    <Cpu size={10} style={{ flexShrink: 0 }} />
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {session.model}
                    </span>
                    <span>&middot;</span>
                    <span>{(session.tokens_used / 1000).toFixed(1)}k tokens</span>
                    {session.context_tokens > 0 && (
                      <span style={{
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 4px',
                        fontSize: '0.625rem',
                      }}>
                        {((session.tokens_used / session.context_tokens) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.6875rem', color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)', flexShrink: 0,
                }}>
                  <Clock size={11} />
                  {session.age_ms != null ? formatAge(session.age_ms) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

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
import { ChevronDown, ChevronRight, MonitorSmartphone, Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import { timeAgo } from '@/lib/time';
import { api, ApiError } from '@/services/api';
import type { ApiResponse } from '@/types/api';

interface ClientSession {
  id: string;
  client_type: string;
  device_label: string;
  device_name: string;
  ip_address: string;
  last_seen_at: string;
  created_at: string;
}

interface ConnectedClient {
  user: {
    id: string;
    display_name: string;
    email: string;
    role: string;
    avatar_path: string | null;
  };
  online: boolean;
  connections: number;
  last_login_at: string | null;
  total_sessions: number;
  sessions: ClientSession[];
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'var(--mod-drive)',
  admin: 'var(--warning)',
  user: 'var(--text-dim)',
};

/**
 * Drive Settings → Connected clients. Read-only roster of users with active
 * web sessions (GET /admin/connected-clients), each expandable to its
 * sessions. A 403 (role=user) falls back to an empty state — session
 * management itself lives in Settings → Sessions.
 */
export function ConnectedClientsSection() {
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.get<ApiResponse<ConnectedClient[]>>('/admin/connected-clients')
      .then(res => { if (!cancelled) setClients(res.data); })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  function lastConnection(c: ConnectedClient): string | null {
    const times = c.sessions.map(s => s.last_seen_at).filter(Boolean);
    if (c.last_login_at) times.push(c.last_login_at);
    if (times.length === 0) return null;
    return times.reduce((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? a : b));
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeader
        title="Connected clients"
        description="Users with an active web session. Read-only — revoke sessions in Settings → Sessions."
      />

      {loading ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '16px 0' }}>Loading…</div>
      ) : forbidden ? (
        <EmptyState
          icon={Users}
          title="Not available"
          description="Connected clients can only be viewed by administrators. Manage your own sessions in Settings → Sessions."
        />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No connected clients"
          description="No users currently have an active session."
        />
      ) : (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', background: 'var(--card)',
        }}>
          {clients.map((c, i) => {
            const isOpen = expanded.has(c.user.id);
            const last = lastConnection(c);
            const name = c.user.display_name || c.user.email;
            return (
              <div key={c.user.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <button
                  onClick={() => toggle(c.user.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '10px 14px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                  <AvatarInitials name={name} src={c.user.avatar_path ?? undefined} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
                    }}>
                      {name}
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: ROLE_COLORS[c.user.role] ?? 'var(--text-dim)',
                        border: `1px solid ${ROLE_COLORS[c.user.role] ?? 'var(--border)'}`,
                        borderRadius: 'var(--radius-full)', padding: '1px 7px',
                      }}>
                        {c.user.role}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.6875rem', color: 'var(--text-dim)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.user.email}
                    </div>
                  </div>

                  {/* Online */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: c.online ? 'var(--success)' : 'var(--text-muted)',
                      display: 'inline-block',
                    }} />
                    {c.online ? `${c.connections} connection${c.connections === 1 ? '' : 's'}` : 'Offline'}
                  </span>

                  {/* Last connection */}
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 88, textAlign: 'right' }}>
                    {last ? timeAgo(last) : '—'}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 14px 12px 50px' }}>
                    {c.sessions.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                        No active sessions.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <SubTh>Device</SubTh>
                            <SubTh>IP address</SubTh>
                            <SubTh align="right">Last seen</SubTh>
                          </tr>
                        </thead>
                        <tbody>
                          {c.sessions.map(s => (
                            <tr key={s.id}>
                              <SubTd>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <MonitorSmartphone size={13} style={{ color: 'var(--text-muted)' }} />
                                  {s.device_label || s.device_name || s.client_type}
                                </span>
                              </SubTd>
                              <SubTd>
                                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>
                                  {s.ip_address || '—'}
                                </span>
                              </SubTd>
                              <SubTd align="right">
                                <span style={{ color: 'var(--text-dim)' }}>
                                  {s.last_seen_at ? timeAgo(s.last_seen_at) : '—'}
                                </span>
                              </SubTd>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

function SubTh({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      textAlign: align, padding: '6px 8px', fontSize: '0.625rem', fontWeight: 600,
      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {children}
    </th>
  );
}

function SubTd({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ textAlign: align, padding: '6px 8px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </td>
  );
}

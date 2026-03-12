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

import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface AuditResult {
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

export function AuditLogSection() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLog = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AuditResult }>('/hal/network/proxy/audit-log', {
        params: { limit: PAGE_SIZE, offset: p * PAGE_SIZE },
      });
      setEntries(res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } catch {
      setEntries([]);
      setTotal(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLog(0); }, [fetchLog]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          Audit Log <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>({total})</span>
        </h2>
        <IconBtn icon={RefreshCw} onClick={() => fetchLog(page)} title="Refresh" />
      </div>

      {loading && entries.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '48px 24px', textAlign: 'center' }}>
          <FileText size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>No audit entries</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Changes to proxy configuration will appear here.</p>
        </div>
      ) : (
        <>
          <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '160px 140px 100px 1fr',
              gap: 0, padding: '10px 16px',
              background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', alignItems: 'center',
            }}>
              <span>Time</span><span>Action</span><span>Target</span><span>Details</span>
            </div>

            {entries.map(entry => (
              <div key={entry.id}>
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '160px 140px 100px 1fr',
                    gap: 0, padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center', background: 'var(--card)',
                    cursor: Object.keys(entry.details).length > 0 ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (Object.keys(entry.details).length > 0) {
                      setExpandedId(expandedId === entry.id ? null : entry.id);
                    }
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatTime(entry.created_at)}
                  </span>
                  <ActionBadge action={entry.action} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {entry.target_type ?? '-'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.target_id ? entry.target_id.substring(0, 8) + '...' : '-'}
                    {Object.keys(entry.details).length > 0 && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.625rem' }}>
                        {expandedId === entry.id ? '\u25b2' : '\u25bc'} JSON
                      </span>
                    )}
                  </span>
                </div>

                {expandedId === entry.id && (
                  <div style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.15)',
                  }}>
                    <pre style={{
                      margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono, monospace)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      maxHeight: 200, overflow: 'auto',
                    }}>
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => fetchLog(page - 1)}
                disabled={page === 0}
                style={pageBtnStyle}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => fetchLog(page + 1)}
                disabled={page >= totalPages - 1}
                style={pageBtnStyle}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    create_host: '#22c55e', update_host: '#3b82f6', delete_host: '#ef4444',
    toggle_host: '#f59e0b', create_acl: '#22c55e', delete_acl: '#ef4444',
    create_cert: '#22c55e', delete_cert: '#ef4444', update_settings: '#a855f7',
    sync: '#6b7280',
  };
  const color = colors[action] ?? '#6b7280';
  return (
    <span style={{
      fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: color + '1a', color,
      textTransform: 'uppercase', letterSpacing: '0.03em',
      display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}><Icon size={14} /></button>;
}

const pageBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)',
};

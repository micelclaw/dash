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
import { Plus, Trash2, RefreshCw, Power, TestTube, Pencil, ArrowRight, Globe, Loader2 } from 'lucide-react';
import type { ProxyHost, ProxyHostInput, UpstreamTestResult } from '../hooks/use-proxy-hosts';
import { HostEditorDialog } from '../components/HostEditorDialog';

interface ProxyHostsSectionProps {
  hosts: ProxyHost[];
  loading: boolean;
  onCreate: (input: ProxyHostInput) => Promise<ProxyHost | null>;
  onUpdate: (id: string, input: Partial<ProxyHostInput>) => Promise<ProxyHost | null>;
  onDelete: (id: string) => Promise<boolean>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onTest: (id: string) => Promise<UpstreamTestResult | null>;
  onRefresh: () => Promise<void>;
}

export function ProxyHostsSection({
  hosts, loading, onCreate, onUpdate, onDelete, onToggle, onTest, onRefresh,
}: ProxyHostsSectionProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editHost, setEditHost] = useState<ProxyHost | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: UpstreamTestResult } | null>(null);

  const handleCreate = async (input: ProxyHostInput) => {
    const result = await onCreate(input);
    if (result) setShowEditor(false);
  };

  const handleUpdate = async (input: ProxyHostInput) => {
    if (!editHost) return;
    const result = await onUpdate(editHost.id, input);
    if (result) { setEditHost(null); setShowEditor(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    const result = await onTest(id);
    if (result) setTestResult({ id, result });
    setTesting(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading hosts...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: 0, fontFamily: 'var(--font-sans)',
        }}>
          Proxy Hosts
          <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            ({hosts.length})
          </span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton icon={RefreshCw} onClick={onRefresh} title="Refresh" />
          <button
            onClick={() => { setEditHost(null); setShowEditor(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} /> Add Host
          </button>
        </div>
      </div>

      {/* Table */}
      {hosts.length === 0 ? (
        <EmptyState onAdd={() => setShowEditor(true)} />
      ) : (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 28px 1fr 80px 80px 100px',
            gap: 0, padding: '10px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', alignItems: 'center',
          }}>
            <span />
            <span>Domain</span>
            <span />
            <span>Destination</span>
            <span>SSL</span>
            <span>Created</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {/* Rows */}
          {hosts.map((host) => (
            <div
              key={host.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 28px 1fr 80px 80px 100px',
                gap: 0, padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: 'var(--card)',
                transition: 'background var(--transition-fast)',
                opacity: host.enabled ? 1 : 0.5,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
            >
              {/* Enabled dot */}
              <button
                onClick={() => onToggle(host.id, !host.enabled)}
                title={host.enabled ? 'Disable' : 'Enable'}
                style={{
                  background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: host.enabled ? '#22c55e' : '#6b7280',
                  boxShadow: host.enabled ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
                }} />
              </button>

              {/* Domain */}
              <div style={{ overflow: 'hidden' }}>
                <div style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.8125rem',
                  color: '#d4a017',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {host.domain_names[0]}
                </div>
                {host.domain_names.length > 1 && (
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    +{host.domain_names.length - 1} more
                  </div>
                )}
                {host.label && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    {host.label}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

              {/* Destination */}
              <div style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {host.scheme}://{host.forward_host}:{host.forward_port ?? 80}
              </div>

              {/* SSL badge */}
              <div>
                <SslBadge mode={host.ssl_mode} />
              </div>

              {/* Created date */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatDate(host.created_at)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <SmallIconBtn
                  icon={testing === host.id ? Loader2 : TestTube}
                  title="Test upstream"
                  onClick={() => handleTest(host.id)}
                  spin={testing === host.id}
                />
                <SmallIconBtn
                  icon={Pencil}
                  title="Edit"
                  onClick={() => { setEditHost(host); setShowEditor(true); }}
                />
                <SmallIconBtn
                  icon={Trash2}
                  title="Delete"
                  onClick={() => handleDelete(host.id)}
                  danger
                  disabled={deleting === host.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test result toast */}
      {testResult && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${testResult.result.reachable ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          background: 'var(--bg)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: testResult.result.reachable ? '#22c55e' : '#ef4444',
          }} />
          <div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {testResult.result.reachable ? 'Upstream reachable' : 'Upstream unreachable'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {testResult.result.address}
              {testResult.result.latency_ms != null && ` (${testResult.result.latency_ms}ms)`}
              {testResult.result.error && ` — ${testResult.result.error}`}
            </div>
          </div>
          <button
            onClick={() => setTestResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Editor dialog */}
      {showEditor && (
        <HostEditorDialog
          host={editHost}
          onSave={editHost ? handleUpdate : handleCreate}
          onClose={() => { setShowEditor(false); setEditHost(null); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <Globe size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
      <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>
        No proxy hosts configured yet
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px' }}>
        Create your first proxy host to route traffic to your services.
      </p>
      <button
        onClick={onAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 20px',
          background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        <Plus size={14} /> Add Proxy Host
      </button>
    </div>
  );
}

function SslBadge({ mode }: { mode: string }) {
  if (mode === 'none') {
    return <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>None</span>;
  }
  const color = mode === 'auto' ? '#22c55e' : '#3b82f6';
  const label = mode === 'auto' ? 'Auto' : mode === 'custom' ? 'Custom' : 'DNS';
  return (
    <span style={{
      fontSize: '0.625rem', fontWeight: 700,
      padding: '2px 6px', borderRadius: 4,
      background: color + '1a', color,
    }}>
      {label}
    </span>
  );
}

function IconButton({ icon: Icon, onClick, title }: {
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: 'var(--text-dim)',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <Icon size={14} />
    </button>
  );
}

function SmallIconBtn({ icon: Icon, title, onClick, danger, disabled, spin }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string; onClick: () => void;
  danger?: boolean; disabled?: boolean; spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--text-muted)',
        opacity: disabled ? 0.4 : 1,
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = danger ? '#f43f5e' : 'var(--text)';
          e.currentTarget.style.borderColor = danger ? 'rgba(244,63,94,0.3)' : 'var(--border)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      <Icon size={13} style={spin ? { animation: 'spin 1s linear infinite' } : undefined} />
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
import { Plus, Trash2, RefreshCw, Globe, Pencil, X, Key } from 'lucide-react';
import type { CloudflareConfigResponse, DnsRecord, DnsRecordInput } from '../hooks/use-cloudflare-dns';

interface DnsSectionProps {
  config: CloudflareConfigResponse | null;
  records: DnsRecord[];
  loading: boolean;
  onSaveConfig: (apiToken: string, zoneId: string) => Promise<void>;
  onRemoveConfig: () => Promise<void>;
  onCreateRecord: (input: DnsRecordInput) => Promise<void>;
  onUpdateRecord: (id: string, input: Partial<DnsRecordInput>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const DNS_TYPES: DnsRecord['type'][] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS'];

const TYPE_COLORS: Record<string, string> = {
  A: '#3b82f6',
  AAAA: '#6366f1',
  CNAME: '#8b5cf6',
  MX: '#22c55e',
  TXT: '#f59e0b',
  SRV: '#ec4899',
  CAA: '#14b8a6',
  NS: '#f97316',
};

const EMPTY_RECORD: DnsRecordInput = {
  type: 'A',
  name: '',
  content: '',
  ttl: 1,
  proxied: false,
};

export function DnsSection({
  config, records, loading,
  onSaveConfig, onRemoveConfig,
  onCreateRecord, onUpdateRecord, onDeleteRecord, onRefresh,
}: DnsSectionProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading DNS configuration...
      </div>
    );
  }

  if (!config?.has_token) {
    return <ConnectCloudflare onSave={onSaveConfig} />;
  }

  return (
    <DnsRecordsView
      config={config}
      records={records}
      onDisconnect={onRemoveConfig}
      onCreate={onCreateRecord}
      onUpdate={onUpdateRecord}
      onDelete={onDeleteRecord}
      onRefresh={onRefresh}
    />
  );
}

// ─── Connect Cloudflare Card ────────────────────────────────────────

function ConnectCloudflare({ onSave }: { onSave: (token: string, zoneId: string) => Promise<void> }) {
  const [token, setToken] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConnect = async () => {
    if (!token || !zoneId) return;
    setSaving(true);
    await onSave(token, zoneId);
    setSaving(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Globe size={36} style={{ color: '#f59e0b', marginBottom: 12 }} />
          <h2 style={{
            fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
            margin: '0 0 6px', fontFamily: 'var(--font-sans)',
          }}>
            Connect Cloudflare
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
            Connect your Cloudflare account to manage DNS records directly from Micelclaw OS.
          </p>
        </div>

        <FieldGroup label="API Token">
          <input
            type="password"
            placeholder="Cloudflare API Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={inputStyle}
          />
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
            Create a scoped API token with <strong>Zone:DNS:Edit</strong> permission in your Cloudflare dashboard.
          </p>
        </FieldGroup>

        <div style={{ marginTop: 12 }}>
          <FieldGroup label="Zone ID">
            <input
              type="text"
              placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
              Found in the Cloudflare dashboard under your domain's overview page.
            </p>
          </FieldGroup>
        </div>

        <button
          onClick={handleConnect}
          disabled={!token || !zoneId || saving}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '10px 20px',
            background: '#f59e0b',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: (!token || !zoneId || saving) ? 'not-allowed' : 'pointer',
            opacity: (!token || !zoneId || saving) ? 0.5 : 1,
          }}
        >
          {saving ? 'Connecting...' : 'Connect Cloudflare'}
        </button>
      </div>
    </div>
  );
}

// ─── DNS Records View ───────────────────────────────────────────────

function DnsRecordsView({ config, records, onDisconnect, onCreate, onUpdate, onDelete, onRefresh }: {
  config: CloudflareConfigResponse;
  records: DnsRecord[];
  onDisconnect: () => Promise<void>;
  onCreate: (input: DnsRecordInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<DnsRecordInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DnsRecordInput>({ ...EMPTY_RECORD });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DnsRecordInput>>({});
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!form.name || !form.content) return;
    setAdding(true);
    await onCreate(form);
    setForm({ ...EMPTY_RECORD });
    setShowForm(false);
    setAdding(false);
  };

  const handleUpdate = async (id: string) => {
    await onUpdate(id, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const startEdit = (record: DnsRecord) => {
    setEditingId(record.id);
    setEditForm({
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      priority: record.priority,
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: 0, fontFamily: 'var(--font-sans)',
        }}>
          DNS Records
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={RefreshCw} onClick={onRefresh} title="Refresh" />
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Add Record
          </button>
        </div>
      </div>

      {/* Zone info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20,
        fontSize: '0.75rem', color: 'var(--text-muted)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Key size={11} />
          Zone: <strong style={{ color: 'var(--text-dim)' }}>{config.zone_name}</strong>
        </span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <button
          onClick={onDisconnect}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: '#f43f5e', fontSize: '0.75rem', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          background: 'var(--surface)',
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
            New DNS Record
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 80px', gap: 12, marginBottom: 12 }}>
            <FieldGroup label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DnsRecord['type'] })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {DNS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Name">
              <input
                type="text"
                placeholder="subdomain"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </FieldGroup>
            <FieldGroup label="Content">
              <input
                type="text"
                placeholder={form.type === 'A' ? '192.168.1.1' : form.type === 'MX' ? 'mail.example.com' : 'value'}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                style={inputStyle}
              />
            </FieldGroup>
            <FieldGroup label="TTL">
              <select
                value={form.ttl ?? 1}
                onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={1}>Auto</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
                <option value={3600}>1h</option>
                <option value={86400}>1d</option>
              </select>
            </FieldGroup>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
            {(form.type === 'A' || form.type === 'AAAA' || form.type === 'CNAME') && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.proxied ?? false}
                  onChange={(e) => setForm({ ...form, proxied: e.target.checked })}
                  style={{ accentColor: '#f59e0b' }}
                />
                Proxied (orange cloud)
              </label>
            )}
            {(form.type === 'MX' || form.type === 'SRV') && (
              <FieldGroup label="Priority" inline>
                <input
                  type="number"
                  placeholder="10"
                  value={form.priority ?? ''}
                  onChange={(e) => setForm({ ...form, priority: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ ...inputStyle, width: 80 }}
                />
              </FieldGroup>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_RECORD }); }} style={cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.name || !form.content || adding}
              style={{
                ...saveBtn,
                background: '#f59e0b', color: '#000',
                opacity: (!form.name || !form.content || adding) ? 0.5 : 1,
                cursor: (!form.name || !form.content || adding) ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? 'Creating...' : 'Create Record'}
            </button>
          </div>
        </div>
      )}

      {/* Records Table */}
      {records.length === 0 ? (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            No DNS records found. Click "Add Record" to create one.
          </p>
        </div>
      ) : (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 1fr 60px 60px 72px',
            padding: '10px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            alignItems: 'center',
          }}>
            <span>Type</span>
            <span>Name</span>
            <span>Content</span>
            <span>TTL</span>
            <span>Proxy</span>
            <span />
          </div>

          {records.map((record) => (
            <div
              key={record.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 1fr 60px 60px 72px',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: editingId === record.id ? 'var(--surface)' : 'var(--card)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (editingId !== record.id) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { if (editingId !== record.id) e.currentTarget.style.background = 'var(--card)'; }}
            >
              {editingId === record.id ? (
                <>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    background: (TYPE_COLORS[record.type] ?? '#6b7280') + '1a',
                    color: TYPE_COLORS[record.type] ?? '#6b7280',
                    textAlign: 'center', width: 'fit-content',
                  }}>
                    {record.type}
                  </span>
                  <input
                    type="text" value={editForm.name ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ ...inputStyle, fontSize: '0.8125rem' }}
                  />
                  <input
                    type="text" value={editForm.content ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    style={{ ...inputStyle, fontSize: '0.8125rem' }}
                  />
                  <span />
                  <span />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <IconBtn icon={CheckIcon} onClick={() => handleUpdate(record.id)} title="Save" color="#22c55e" />
                    <IconBtn icon={X} onClick={() => { setEditingId(null); setEditForm({}); }} title="Cancel" />
                  </div>
                </>
              ) : (
                <>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    background: (TYPE_COLORS[record.type] ?? '#6b7280') + '1a',
                    color: TYPE_COLORS[record.type] ?? '#6b7280',
                    textAlign: 'center', width: 'fit-content',
                  }}>
                    {record.type}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem',
                    color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {record.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem',
                    color: 'var(--text-dim)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {record.content}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {record.ttl === 1 ? 'Auto' : formatTtl(record.ttl)}
                  </span>
                  <span>
                    {record.proxied && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#f59e0b', display: 'inline-block',
                      }} />
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!record.locked && (
                      <>
                        <IconBtn icon={Pencil} onClick={() => startEdit(record)} title="Edit" />
                        <IconBtn icon={Trash2} onClick={() => onDelete(record.id)} title="Delete" color="#f43f5e" />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────

function CheckIcon({ size, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconBtn({ icon: Icon, onClick, title, color }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  onClick: () => void;
  title: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: color ?? 'var(--text-muted)',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = (color ?? 'var(--border)') + '55'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
    >
      <Icon size={14} />
    </button>
  );
}

function FieldGroup({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={inline ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)',
        marginBottom: inline ? 0 : 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)',
  outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};

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

import { useState, useEffect } from 'react';
import {
  RefreshCw, Plus, Trash2, Pencil, X, Shield, Cloud,
  CheckCircle, AlertTriangle, FileText, Zap, Lock, Info, Copy,
} from 'lucide-react';
import type { DnsZone, DnsRecord, DnsRecordInput, DnsRecordType, DnssecStatus } from '../hooks/use-dns-zones';
import { DnsCallout } from '../components/DnsCallout';
import { InfoTooltip } from '../components/InfoTooltip';
import { CopyBlock } from '../components/CopyBlock';
import { useSplitHorizon, type SplitHorizonInput } from '../hooks/use-split-horizon';

interface ZoneEditorProps {
  zone: DnsZone;
  records: DnsRecord[];
  loading: boolean;
  onSync: () => Promise<void>;
  onVerifyNs: () => Promise<unknown>;
  onUpdateDdns: (enabled: boolean, recordIds: string[]) => Promise<void>;
  onCreateRecord: (input: DnsRecordInput) => Promise<void>;
  onUpdateRecord: (recordId: string, input: Partial<DnsRecordInput>) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
  onShowTemplates: () => void;
  onRemove: () => void;
  onGetDnssecStatus: (zoneId: string) => Promise<DnssecStatus | null>;
  onEnableDnssec: (zoneId: string) => Promise<DnssecStatus | null>;
  onDisableDnssec: (zoneId: string) => Promise<void>;
}

const DNS_TYPES: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS'];

const TYPE_COLORS: Record<string, string> = {
  A: '#3b82f6', AAAA: '#6366f1', CNAME: '#8b5cf6', MX: '#22c55e',
  TXT: '#f59e0b', SRV: '#ec4899', CAA: '#14b8a6', NS: '#f97316',
};

const EMPTY_RECORD: DnsRecordInput = { type: 'A', name: '', content: '', ttl: 1, proxied: false };

export function ZoneEditor({
  zone, records, loading,
  onSync, onVerifyNs, onUpdateDdns,
  onCreateRecord, onUpdateRecord, onDeleteRecord,
  onShowTemplates, onRemove,
  onGetDnssecStatus, onEnableDnssec, onDisableDnssec,
}: ZoneEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DnsRecordInput>({ ...EMPTY_RECORD });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DnsRecordInput>>({});
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleAdd = async () => {
    if (!form.name || !form.content) return;
    setAdding(true);
    await onCreateRecord(form);
    setForm({ ...EMPTY_RECORD });
    setShowForm(false);
    setAdding(false);
  };

  const handleUpdate = async (id: string) => {
    await onUpdateRecord(id, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const startEdit = (record: DnsRecord) => {
    setEditingId(record.id);
    setEditForm({
      type: record.type, name: record.name, content: record.content,
      ttl: record.ttl, proxied: record.proxied, priority: record.priority,
    });
  };

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {zone.mode === 'authoritative'
            ? <Shield size={20} style={{ color: '#3b82f6' }} />
            : <Cloud size={20} style={{ color: '#f59e0b' }} />}
          <h2 style={{
            fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-mono, monospace)',
          }}>
            {zone.zone}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={FileText} onClick={onShowTemplates} title="Apply Template" />
          <IconBtn icon={RefreshCw} onClick={onSync} title="Sync" />
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Add Record
          </button>
        </div>
      </div>

      {/* Zone meta */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20, fontSize: '0.75rem', color: 'var(--text-muted)',
      }}>
        <span>{zone.mode === 'authoritative' ? 'Authoritative' : 'Proxy'}</span>
        {zone.provider_label && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>{zone.provider_label}</span>
          </>
        )}
        {zone.mode === 'authoritative' && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              NS:
              {zone.ns_verified
                ? <><CheckCircle size={11} style={{ color: '#22c55e' }} /> Verified</>
                : <button onClick={() => onVerifyNs()} style={{
                    background: 'none', border: 'none', padding: 0,
                    color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <AlertTriangle size={11} /> Verify
                  </button>}
            </span>
          </>
        )}
        {zone.ddns_enabled && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}>
              <Zap size={11} /> DDNS
            </span>
          </>
        )}
      </div>

      {/* Add Record Form */}
      {showForm && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          background: 'var(--surface)',
          padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
            New DNS Record
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 80px', gap: 12, marginBottom: 12 }}>
            <FieldGroup label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DnsRecordType })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {DNS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Name">
              <input
                type="text" placeholder="subdomain"
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
                  type="checkbox" checked={form.proxied ?? false}
                  onChange={(e) => setForm({ ...form, proxied: e.target.checked })}
                  style={{ accentColor: '#f59e0b' }}
                />
                Proxied (orange cloud)
              </label>
            )}
            {(form.type === 'MX' || form.type === 'SRV') && (
              <FieldGroup label="Priority" inline>
                <input
                  type="number" placeholder="10"
                  value={form.priority ?? ''}
                  onChange={(e) => setForm({ ...form, priority: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ ...inputStyle, width: 80 }}
                />
              </FieldGroup>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_RECORD }); }} style={cancelBtn}>Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!form.name || !form.content || adding}
              style={{
                ...saveBtn, background: '#3b82f6', color: '#fff',
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
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading records...
        </div>
      ) : records.length === 0 ? (
        <div style={{
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          background: 'var(--surface)', padding: '48px 24px', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            No records. Click "Add Record" or "Apply Template" to get started.
          </p>
        </div>
      ) : (
        <div style={{
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 1fr 60px 60px 72px',
            padding: '10px 16px', background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', alignItems: 'center',
          }}>
            <span>Type</span><span>Name</span><span>Content</span><span>TTL</span><span>Proxy</span><span />
          </div>

          {records.map((record) => (
            <div
              key={record.id}
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 1fr 60px 60px 72px',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: editingId === record.id ? 'var(--surface)' : 'var(--card)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (editingId !== record.id) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { if (editingId !== record.id) e.currentTarget.style.background = 'var(--card)'; }}
            >
              {editingId === record.id ? (
                <>
                  <TypeBadge type={record.type} />
                  <input type="text" value={editForm.name ?? ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, fontSize: '0.8125rem' }} />
                  <input type="text" value={editForm.content ?? ''} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} style={{ ...inputStyle, fontSize: '0.8125rem' }} />
                  <span />
                  <span />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <IconBtn icon={CheckIcon} onClick={() => handleUpdate(record.id)} title="Save" color="#22c55e" />
                    <IconBtn icon={X} onClick={() => { setEditingId(null); setEditForm({}); }} title="Cancel" />
                  </div>
                </>
              ) : (
                <>
                  <TypeBadge type={record.type} />
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {record.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {record.content}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {record.ttl === 1 ? 'Auto' : formatTtl(record.ttl)}
                  </span>
                  <span>
                    {record.proxied && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!record.locked && (
                      <>
                        <IconBtn icon={Pencil} onClick={() => startEdit(record)} title="Edit" />
                        <IconBtn icon={Trash2} onClick={() => onDeleteRecord(record.id)} title="Delete" color="#f43f5e" />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Split-Horizon — only for authoritative zones */}
      {zone.mode === 'authoritative' && (
        <SplitHorizonPanel zoneId={zone.id} zoneName={zone.zone} />
      )}

      {/* DNSSEC — only for public authoritative zones */}
      {zone.mode === 'authoritative' && zone.zone_type !== 'local' && (
        <DnssecPanel
          zoneId={zone.id}
          onGetStatus={onGetDnssecStatus}
          onEnable={onEnableDnssec}
          onDisable={onDisableDnssec}
        />
      )}

      {/* Zone danger zone */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        {confirmRemove ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: '#f43f5e' }}>Remove this zone and all its records?</span>
            <button onClick={onRemove} style={{
              padding: '6px 14px', background: '#f43f5e', border: 'none',
              borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.8125rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              Confirm
            </button>
            <button onClick={() => setConfirmRemove(false)} style={cancelBtn}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'transparent',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)', color: '#f43f5e',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
            Remove Zone
          </button>
        )}
      </div>
    </>
  );
}

// ─── Split-Horizon Panel ────────────────────────────────────────────

function SplitHorizonPanel({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const splitHorizon = useSplitHorizon();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SplitHorizonInput>({
    record_name: '', internal_ip: '', external_ip: '', internal_networks: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    splitHorizon.fetchRecords(zoneId);
    splitHorizon.fetchDefaultNetworks();
  }, [zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!form.record_name || !form.internal_ip || !form.external_ip) return;
    setSubmitting(true);
    const networks = (form.internal_networks && form.internal_networks.length > 0)
      ? form.internal_networks
      : splitHorizon.defaultNetworks;
    const result = await splitHorizon.createRecord(zoneId, {
      ...form,
      internal_networks: networks,
    });
    setSubmitting(false);
    if (result) {
      setForm({ record_name: '', internal_ip: '', external_ip: '', internal_networks: [] });
      setShowForm(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
      }}>
        Split-Horizon DNS
      </div>

      <DnsCallout icon={Info} collapsible defaultCollapsed={splitHorizon.records.length > 0} title="¿Qué es Split-Horizon?">
        <p style={{ margin: '0 0 8px' }}>
          Hace que un mismo dominio devuelva IPs diferentes según desde dónde preguntes.
          Cuando estás en casa, <strong style={{ color: 'var(--text)' }}>app.{zoneName}</strong> apunta directamente
          a tu servidor local (más rápido). Desde internet, apunta a tu IP pública.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Beneficio: tu tráfico no sale a internet y vuelve (hairpin NAT), la conexión es directa.
        </p>
        {/* Visual diagram */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6,
          padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)',
        }}>
          <div style={{ textAlign: 'right', color: 'var(--text)' }}>Desde tu red</div>
          <div style={{ color: 'var(--text-muted)' }}>{'->'}</div>
          <div style={{ color: '#22c55e' }}>192.168.1.50 (directo)</div>
          <div style={{ textAlign: 'right', color: 'var(--text)' }}>Desde internet</div>
          <div style={{ color: 'var(--text-muted)' }}>{'->'}</div>
          <div style={{ color: '#3b82f6' }}>85.123.45.67 (IP pública)</div>
        </div>
      </DnsCallout>

      {/* Records list */}
      <div style={{ marginTop: 12 }}>
        {splitHorizon.loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Cargando split-horizon records...
          </div>
        ) : splitHorizon.records.length > 0 && (
          <div style={{
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            overflow: 'hidden', marginBottom: 12,
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
              padding: '8px 14px', background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.625rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--text-muted)',
            }}>
              <span>Nombre</span>
              <span>IP Interna</span>
              <span>IP Externa</span>
              <span style={{ width: 40, textAlign: 'center' }} />
            </div>
            {splitHorizon.records.map((rec, i) => (
              <div key={rec.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                padding: '10px 14px', background: 'var(--card)',
                borderBottom: i < splitHorizon.records.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem',
              }}>
                <span style={{ color: 'var(--text)' }}>{rec.record_name}.{zoneName}</span>
                <span style={{ color: '#22c55e' }}>{rec.internal_ip}</span>
                <span style={{ color: '#3b82f6' }}>{rec.external_ip}</span>
                <div style={{ width: 40, textAlign: 'center' }}>
                  {confirmDelete === rec.id ? (
                    <button
                      onClick={() => { splitHorizon.removeRecord(zoneId, rec.id); setConfirmDelete(null); }}
                      style={{
                        padding: '2px 6px', fontSize: '0.625rem', fontWeight: 600,
                        background: '#ef4444', color: '#fff',
                        border: 'none', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      OK
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(rec.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)',
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)', fontSize: '0.8125rem',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Añadir split record
          </button>
        )}

        {/* Add form */}
        {showForm && (
          <div style={{
            padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--card)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4,
                }}>
                  Nombre del registro
                  <InfoTooltip>El subdominio que tendrá respuesta diferente según la red de origen</InfoTooltip>
                </div>
                <input
                  type="text" placeholder="app"
                  value={form.record_name}
                  onChange={(e) => setForm({ ...form, record_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4,
                }}>
                  IP interna (LAN)
                  <InfoTooltip>La IP del servicio en tu red local</InfoTooltip>
                </div>
                <input
                  type="text" placeholder="192.168.1.50"
                  value={form.internal_ip}
                  onChange={(e) => setForm({ ...form, internal_ip: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4,
                }}>
                  IP externa (internet)
                  <InfoTooltip>Tu IP pública. Es la que ven los usuarios desde internet</InfoTooltip>
                </div>
                <input
                  type="text" placeholder="85.123.45.67"
                  value={form.external_ip}
                  onChange={(e) => setForm({ ...form, external_ip: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Networks hint */}
            <div style={{
              padding: '8px 12px', marginBottom: 12,
              background: 'var(--surface)', borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem', color: 'var(--text-muted)',
            }}>
              <strong style={{ color: 'var(--text-dim)' }}>Redes internas:</strong>{' '}
              {(splitHorizon.defaultNetworks.length > 0 ? splitHorizon.defaultNetworks : ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']).join(', ')}
              <InfoTooltip side="right">
                Rangos de IPs que se consideran red local. Los valores por defecto cubren todas las redes privadas estándar (RFC 1918).
              </InfoTooltip>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowForm(false); setForm({ record_name: '', internal_ip: '', external_ip: '', internal_networks: [] }); }}
                style={cancelBtn}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.record_name || !form.internal_ip || !form.external_ip || submitting}
                style={{
                  ...saveBtn,
                  background: (!form.record_name || !form.internal_ip || !form.external_ip || submitting) ? 'var(--surface-hover)' : '#3b82f6',
                  color: (!form.record_name || !form.internal_ip || !form.external_ip || submitting) ? 'var(--text-muted)' : '#fff',
                  cursor: (!form.record_name || !form.internal_ip || !form.external_ip || submitting) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Creando...' : 'Crear split record'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DNSSEC Panel ───────────────────────────────────────────────────

function DnssecPanel({ zoneId, onGetStatus, onEnable, onDisable }: {
  zoneId: string;
  onGetStatus: (id: string) => Promise<DnssecStatus | null>;
  onEnable: (id: string) => Promise<DnssecStatus | null>;
  onDisable: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<DnssecStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await onGetStatus(zoneId);
      if (!cancelled) { setStatus(s); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [zoneId, onGetStatus]);

  const handleEnable = async () => {
    setToggling(true);
    const s = await onEnable(zoneId);
    if (s) setStatus(s);
    setToggling(false);
  };

  const handleDisable = async () => {
    setToggling(true);
    await onDisable(zoneId);
    setStatus({ enabled: false, algorithm: null, keys: [], ds_records: [] });
    setToggling(false);
    setConfirmDisable(false);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
      }}>
        DNSSEC
      </div>

      <DnsCallout icon={Lock} collapsible defaultCollapsed={!status?.enabled} title="¿Qué es DNSSEC?">
        <p style={{ margin: '0 0 8px' }}>
          DNSSEC es como un sello de garantía para tus registros DNS. Firma cada respuesta criptográficamente
          para que nadie pueda falsificarla. Protege contra ataques de envenenamiento de caché DNS.
        </p>
        <p style={{ margin: 0 }}>
          Es especialmente importante si usas tu dominio para email o servicios críticos.
          Una vez activado, necesitarás añadir los registros DS en tu registrador de dominios.
        </p>
      </DnsCallout>

      {loading ? (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Comprobando estado DNSSEC...
        </div>
      ) : (
        <div style={{
          marginTop: 12, padding: 16,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: status?.enabled ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} style={{ color: status?.enabled ? '#22c55e' : 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                {status?.enabled ? 'DNSSEC activo' : 'DNSSEC desactivado'}
              </span>
              {status?.enabled && status.algorithm && (
                <span style={{
                  fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
                  borderRadius: 3, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                }}>
                  {status.algorithm}
                </span>
              )}
            </div>

            {status?.enabled ? (
              confirmDisable ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleDisable} disabled={toggling} style={{
                    padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                    background: '#ef4444', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', opacity: toggling ? 0.6 : 1,
                  }}>
                    {toggling ? 'Desactivando...' : 'Confirmar'}
                  </button>
                  <button onClick={() => setConfirmDisable(false)} style={{
                    padding: '5px 12px', fontSize: '0.75rem',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                  }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDisable(true)} style={{
                  padding: '5px 12px', fontSize: '0.75rem',
                  background: 'transparent', border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  color: '#f43f5e', fontFamily: 'var(--font-sans)',
                }}>
                  Desactivar
                </button>
              )
            ) : (
              <button onClick={handleEnable} disabled={toggling} style={{
                padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                background: '#22c55e', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', opacity: toggling ? 0.6 : 1,
              }}>
                {toggling ? 'Activando...' : 'Activar DNSSEC'}
              </button>
            )}
          </div>

          {/* DS Records — show when DNSSEC is enabled */}
          {status?.enabled && status.ds_records.length > 0 && (
            <div>
              <div style={{
                padding: '10px 14px', marginBottom: 12,
                background: 'rgba(212, 160, 23, 0.06)', border: '1px solid rgba(212, 160, 23, 0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                Copia estos registros DS y añádelos en el panel de tu registrador de dominios
                (donde compraste el dominio). Sin esto, DNSSEC no se validará desde internet.
              </div>

              {/* DS Records table */}
              <div style={{
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '80px 100px 100px 1fr',
                  padding: '8px 14px', background: 'var(--surface)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.625rem', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                }}>
                  <span>Key Tag</span>
                  <span>Algorithm</span>
                  <span>Digest Type</span>
                  <span>Digest</span>
                </div>
                {status.ds_records.map((ds, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '80px 100px 100px 1fr',
                    padding: '10px 14px', background: 'var(--card)',
                    borderBottom: i < status.ds_records.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem',
                  }}>
                    <span style={{ color: 'var(--text)' }}>{ds.key_tag}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{ds.algorithm}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{ds.digest_type}</span>
                    <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ds.digest}
                    </span>
                  </div>
                ))}
              </div>

              {/* Copy all DS records */}
              <div style={{ marginTop: 10 }}>
                <CopyBlock
                  label="Todos los registros DS"
                  code={status.ds_records.map(ds => `${ds.key_tag} ${ds.algorithm} ${ds.digest_type} ${ds.digest}`).join('\n')}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3,
      background: (TYPE_COLORS[type] ?? '#6b7280') + '1a',
      color: TYPE_COLORS[type] ?? '#6b7280',
      textAlign: 'center', width: 'fit-content',
    }}>
      {type}
    </span>
  );
}

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
      onClick={onClick} title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, background: 'transparent',
        border: '1px solid transparent', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', color: color ?? 'var(--text-muted)',
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
        color: 'var(--text-muted)', marginBottom: inline ? 0 : 4,
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
  width: '100%', padding: '8px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)', outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  padding: '6px 14px', border: 'none',
  borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
  fontWeight: 600, fontFamily: 'var(--font-sans)',
};

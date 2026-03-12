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
import { Plus, Trash2, RefreshCw, Lock, ShieldCheck } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Certificate {
  id: string;
  provider: string;
  domain_names: string[];
  cert_path: string | null;
  key_path: string | null;
  acme_email: string | null;
  dns_provider: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

export function CertificatesSection() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [domains, setDomains] = useState('');
  const [provider, setProvider] = useState('letsencrypt');
  const [acmeEmail, setAcmeEmail] = useState('');

  const fetchCerts = useCallback(async () => {
    try {
      const res = await api.get<{ data: Certificate[] }>('/hal/network/proxy/certificates');
      setCerts(res.data);
    } catch { setCerts([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  const handleCreate = async () => {
    const domainList = domains.split(',').map(d => d.trim()).filter(Boolean);
    if (!domainList.length) return;
    setSaving(true);
    try {
      await api.post('/hal/network/proxy/certificates', {
        domain_names: domainList,
        provider,
        acme_email: acmeEmail || undefined,
      });
      toast.success('Certificate created');
      setShowForm(false);
      setDomains('');
      setAcmeEmail('');
      await fetchCerts();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create certificate');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/hal/network/proxy/certificates/${id}`);
      toast.success('Certificate deleted');
      await fetchCerts();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete certificate');
    }
    setDeleting(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading certificates...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          SSL Certificates <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>({certs.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={RefreshCw} onClick={fetchCerts} title="Refresh" />
          <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}><Plus size={14} /> Add Certificate</button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(34,197,94,0.2)',
        background: 'rgba(34,197,94,0.04)',
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: '0.8125rem',
        color: 'var(--text-dim)',
        lineHeight: 1.5,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <ShieldCheck size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Auto-SSL:</strong> Caddy automatically obtains and renews certificates for proxy hosts with SSL mode "Auto".
          Certificates listed here are for manual management and custom certificate uploads.
        </div>
      </div>

      {showForm && (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.3)', background: 'var(--surface)', padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>New Certificate</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Domain Names (comma-separated)</Label>
              <input type="text" placeholder="example.com, www.example.com" value={domains} onChange={(e) => setDomains(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <Label>Provider</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} style={inputStyle}>
                <option value="letsencrypt">Let's Encrypt</option>
                <option value="zerossl">ZeroSSL</option>
                <option value="self_signed">Self-signed</option>
              </select>
            </div>
          </div>
          {provider !== 'self_signed' && (
            <div style={{ marginBottom: 16 }}>
              <Label>ACME Email (optional)</Label>
              <input type="email" placeholder="admin@example.com" value={acmeEmail} onChange={(e) => setAcmeEmail(e.target.value)} style={{ ...inputStyle, maxWidth: 300 }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreate} disabled={!domains.trim() || saving} style={{ ...saveBtnStyle, opacity: (!domains.trim() || saving) ? 0.5 : 1, cursor: (!domains.trim() || saving) ? 'not-allowed' : 'pointer' }}>{saving ? 'Creating...' : 'Create Certificate'}</button>
          </div>
        </div>
      )}

      {certs.length === 0 ? (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '48px 24px', textAlign: 'center' }}>
          <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>No custom certificates</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Caddy handles auto-SSL automatically. Add custom certificates here if needed.</p>
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 44px', gap: 0, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', alignItems: 'center' }}>
            <span>Domains</span><span>Provider</span><span>Status</span><span>Expires</span><span />
          </div>
          {certs.map(cert => (
            <div key={cert.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px 44px', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: 'var(--card)' }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cert.domain_names.join(', ')}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{formatProvider(cert.provider)}</span>
              <StatusBadge status={cert.status} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
              </span>
              <button onClick={() => handleDelete(cert.id)} disabled={deleting === cert.id} title="Delete" style={deleteBtnStyle}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: '#22c55e', pending: '#f59e0b', expired: '#ef4444', provisioning: '#3b82f6' };
  const c = colors[status] ?? '#6b7280';
  return (
    <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: c + '1a', color: c, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

function formatProvider(p: string) {
  switch (p) {
    case 'letsencrypt': return "Let's Encrypt";
    case 'zerossl': return 'ZeroSSL';
    case 'self_signed': return 'Self-signed';
    case 'custom': return 'Custom';
    default: return p;
  }
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}><Icon size={14} /></button>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', outline: 'none' };
const addBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#22c55e', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)' };
const deleteBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' };

import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Ban, X } from 'lucide-react';
import type { ProxyHost, ProxyHostInput } from '../hooks/use-proxy-hosts';

interface NotFoundHostsSectionProps {
  hosts: ProxyHost[];
  loading: boolean;
  onCreate: (input: ProxyHostInput) => Promise<ProxyHost | null>;
  onDelete: (id: string) => Promise<boolean>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function NotFoundHostsSection({ hosts, loading, onCreate, onDelete, onToggle, onRefresh }: NotFoundHostsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<string[]>([]);

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (d && !domains.includes(d)) setDomains([...domains, d]);
    setDomainInput('');
  };

  const resetForm = () => { setDomains([]); setDomainInput(''); };

  const handleCreate = async () => {
    if (!domains.length) return;
    setSaving(true);
    const result = await onCreate({
      host_type: '404_host',
      domain_names: domains,
      ssl_mode: 'none',
    });
    if (result) { setShowForm(false); resetForm(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading 404 hosts...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          404 Hosts <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>({hosts.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={RefreshCw} onClick={onRefresh} title="Refresh" />
          <button onClick={() => { setShowForm(!showForm); resetForm(); }} style={addBtnStyle}><Plus size={14} /> Add 404 Host</button>
        </div>
      </div>

      {showForm && (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.3)', background: 'var(--surface)', padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>New 404 Host</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
            Domains matched here will always return a 404 Not Found response. Useful for blocking unwanted domains.
          </p>
          <div style={{ marginBottom: 14 }}>
            <Label>Domain Names</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="e.g. blocked.example.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addDomain} style={smallAddBtn}><Plus size={14} /></button>
            </div>
            {domains.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {domains.map(d => (
                  <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {d}
                    <button onClick={() => setDomains(domains.filter(x => x !== d))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreate} disabled={!domains.length || saving} style={{ ...saveBtnStyle, opacity: (!domains.length || saving) ? 0.5 : 1, cursor: (!domains.length || saving) ? 'not-allowed' : 'pointer' }}>{saving ? 'Creating...' : 'Create 404 Host'}</button>
          </div>
        </div>
      )}

      {hosts.length === 0 ? (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '48px 24px', textAlign: 'center' }}>
          <Ban size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>No 404 hosts</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Add domains that should always return 404.</p>
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 44px', gap: 0, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', alignItems: 'center' }}>
            <span /><span>Domain</span><span>Created</span><span />
          </div>
          {hosts.map(host => (
            <div key={host.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 44px', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: 'var(--card)', opacity: host.enabled ? 1 : 0.5 }}>
              <button onClick={() => onToggle(host.id, !host.enabled)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: host.enabled ? '#22c55e' : '#6b7280' }} /></button>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host.domain_names.join(', ')}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(host.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <button onClick={() => handleDelete(host.id)} disabled={deleting === host.id} title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-sm)', cursor: deleting === host.id ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: deleting === host.id ? 0.4 : 1 }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}><Icon size={14} /></button>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', outline: 'none' };
const addBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const smallAddBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0, background: '#f59e0b', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#f59e0b', border: 'none', borderRadius: 'var(--radius-md)', color: '#000', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)' };

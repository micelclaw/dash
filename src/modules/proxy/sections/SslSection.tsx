import { useState } from 'react';
import { ShieldCheck, Globe, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { ProxyStatus, DomainInfo } from '../hooks/use-proxy';

interface SslSectionProps {
  status: ProxyStatus | null;
  domain: DomainInfo | null;
  loading: boolean;
  onSetDomain: (domain: string) => Promise<void>;
}

export function SslSection({ status, domain, loading, onSetDomain }: SslSectionProps) {
  const [editing, setEditing] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!domainInput.trim()) return;
    setSaving(true);
    await onSetDomain(domainInput.trim());
    setEditing(false);
    setDomainInput('');
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading SSL status...
      </div>
    );
  }

  const sslStatus = status?.ssl_status ?? 'none';
  const sslColor = SSL_COLORS[sslStatus];
  const SslIcon = SSL_ICONS[sslStatus];

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 20px', fontFamily: 'var(--font-sans)',
      }}>
        SSL / Certificates
      </h2>

      {/* Domain Card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Globe size={18} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Domain
          </span>
        </div>

        {status?.domain ? (
          <div>
            <div style={{
              fontSize: '1rem', fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 8,
            }}>
              {status.domain}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: domain?.dns_configured ? '#22c55e' : '#f59e0b',
              }} />
              {domain?.dns_configured ? 'DNS configured' : 'DNS not pointing to this server'}
              {domain?.public_ip && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                  Public IP: {domain.public_ip}
                </span>
              )}
            </div>
          </div>
        ) : editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono, monospace)',
                outline: 'none',
              }}
            />
            <button onClick={() => setEditing(false)} style={cancelBtn}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!domainInput.trim() || saving}
              style={{
                ...saveBtn,
                opacity: (!domainInput.trim() || saving) ? 0.5 : 1,
                cursor: (!domainInput.trim() || saving) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Set Domain'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 12px' }}>
              No domain configured. Set a domain to enable automatic SSL via Let's Encrypt.
            </p>
            <button onClick={() => setEditing(true)} style={saveBtn}>
              Set Up Domain
            </button>
          </div>
        )}
      </div>

      {/* SSL Certificate Card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${sslColor}33`,
        background: `linear-gradient(135deg, ${sslColor}08, ${sslColor}03)`,
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SslIcon size={18} style={{ color: sslColor }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Certificate Status
          </span>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: '0.6875rem', fontWeight: 700,
            background: sslColor + '1a',
            color: sslColor,
            marginLeft: 'auto',
          }}>
            {sslStatus.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <MetricItem label="Provider" value={formatProvider(status?.ssl_provider)} />
          <MetricItem label="Status" value={formatStatus(sslStatus)} />
          {status?.ssl_expiry && (
            <MetricItem label="Expires" value={new Date(status.ssl_expiry).toLocaleDateString()} />
          )}
        </div>
      </div>

      {/* Auto-renewal note */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 16,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <ShieldCheck size={16} style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
            Caddy automatically manages certificate renewal. When a domain is configured and DNS points to this server,
            Caddy provisions a free certificate from Let's Encrypt and renews it before expiration.
          </p>
        </div>
      </div>
    </div>
  );
}

const SSL_COLORS: Record<string, string> = {
  none: '#6b7280',
  pending: '#f59e0b',
  active: '#22c55e',
  expired: '#f43f5e',
};

const SSL_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  none: AlertCircle,
  pending: Clock,
  active: CheckCircle,
  expired: AlertCircle,
};

function formatProvider(provider?: string) {
  switch (provider) {
    case 'letsencrypt': return "Let's Encrypt";
    case 'zerossl': return 'ZeroSSL';
    case 'self_signed': return 'Self-signed';
    case 'custom': return 'Custom';
    default: return 'None';
  }
}

function formatStatus(status: string) {
  switch (status) {
    case 'none': return 'No certificate';
    case 'pending': return 'Provisioning...';
    case 'active': return 'Valid & active';
    case 'expired': return 'Certificate expired';
    default: return status;
  }
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

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
  cursor: 'pointer',
};

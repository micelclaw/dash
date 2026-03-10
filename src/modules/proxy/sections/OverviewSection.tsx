import { Globe, ArrowRight, ShieldCheck, Server } from 'lucide-react';
import type { ProxyStatus, ProxyRoute } from '../hooks/use-proxy';
import type { ProxySection } from '../ProxySidebar';

interface OverviewSectionProps {
  status: ProxyStatus | null;
  routes: ProxyRoute[];
  loading: boolean;
  onNavigate: (section: ProxySection) => void;
}

export function OverviewSection({ status, routes, loading, onNavigate }: OverviewSectionProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading proxy status...
      </div>
    );
  }

  const sslColor = SSL_COLORS[status?.ssl_status ?? 'none'];

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      {/* Hero Card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.02))',
        padding: 24,
        marginBottom: 20,
        textAlign: 'center',
      }}>
        <Globe size={36} style={{ color: '#3b82f6', marginBottom: 12 }} />
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)',
          margin: '0 0 6px', fontFamily: 'var(--font-sans)',
        }}>
          Reverse Proxy Management
        </h2>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.8125rem',
          margin: '0 0 20px', lineHeight: 1.5,
        }}>
          Manage proxy routes, SSL certificates, and DNS records through Caddy.
        </p>
        <button
          onClick={() => onNavigate('hosts')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 28px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Manage Proxy Hosts
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Status Banner */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${status?.running ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        background: status?.running
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))'
          : 'var(--surface)',
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: status?.running ? '#22c55e' : '#6b7280',
            boxShadow: status?.running ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
          }} />
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Caddy {status?.running ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <MetricItem label="Domain" value={status?.domain ?? 'Not configured'} />
          <MetricItem label="Proxy Hosts" value={String(routes.length)} />
          <MetricItem label="SSL Provider" value={formatProvider(status?.ssl_provider)} />
        </div>
      </div>

      {/* SSL + Routes summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* SSL Card */}
        <button
          onClick={() => onNavigate('ssl')}
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 20,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ShieldCheck size={18} style={{ color: sslColor }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              SSL / Certificates
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem', fontWeight: 600,
              background: sslColor + '1a',
              color: sslColor,
            }}>
              {(status?.ssl_status ?? 'none').toUpperCase()}
            </span>
            {status?.ssl_expiry && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Expires {new Date(status.ssl_expiry).toLocaleDateString()}
              </span>
            )}
          </div>
        </button>

        {/* Routes summary Card */}
        <button
          onClick={() => onNavigate('hosts')}
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 20,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Server size={18} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Proxy Hosts
            </span>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
            {routes.length}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
            active route{routes.length !== 1 ? 's' : ''}
          </span>
        </button>
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

function formatProvider(provider?: string) {
  switch (provider) {
    case 'letsencrypt': return "Let's Encrypt";
    case 'zerossl': return 'ZeroSSL';
    case 'self_signed': return 'Self-signed';
    case 'custom': return 'Custom';
    default: return 'None';
  }
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
        {value}
      </div>
    </div>
  );
}

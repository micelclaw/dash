import { useEffect, useRef } from 'react';
import { Globe, ArrowRight, ShieldCheck, Server, Terminal, X, Loader2, ArrowLeftRight, Ban, RefreshCw } from 'lucide-react';
import type { ProxyStatus, ProcessLog } from '../hooks/use-proxy-status';
import type { ProxyHost } from '../hooks/use-proxy-hosts';
import type { ProxySection } from '../ProxySidebar';

interface DashboardSectionProps {
  status: ProxyStatus | null;
  hosts: ProxyHost[];
  loading: boolean;
  actionInProgress: 'start' | 'stop' | null;
  processLog: ProcessLog | null;
  onClearLog: () => void;
  onNavigate: (section: ProxySection) => void;
  onStart: () => void;
  onStop: () => void;
  onSync: () => void;
}

export function DashboardSection({
  status, hosts, loading, actionInProgress, processLog,
  onClearLog, onNavigate, onStart, onStop, onSync,
}: DashboardSectionProps) {
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

  const proxyCount = hosts.filter(h => h.host_type === 'proxy').length;
  const redirectCount = hosts.filter(h => h.host_type === 'redirect').length;
  const notfoundCount = hosts.filter(h => h.host_type === '404_host').length;
  const enabledCount = hosts.filter(h => h.enabled).length;

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: status?.running ? '#22c55e' : '#6b7280',
              boxShadow: status?.running ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
            }} />
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Caddy {status?.running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onSync}
              title="Sync config to Caddy"
              style={{
                height: 32, padding: '0 12px',
                background: 'transparent',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem', fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={12} />
              Sync
            </button>
            <button
              onClick={status?.running ? onStop : onStart}
              disabled={!!actionInProgress}
              style={{
                height: 32, padding: '0 16px',
                background: actionInProgress ? 'var(--surface-hover)' : status?.running ? 'transparent' : '#22c55e',
                color: actionInProgress ? 'var(--text-muted)' : status?.running ? '#ef4444' : '#fff',
                border: status?.running ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: actionInProgress ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {actionInProgress && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {actionInProgress ? (actionInProgress === 'start' ? 'Starting...' : 'Stopping...') : status?.running ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <MetricItem label="Total Hosts" value={String(hosts.length)} />
          <MetricItem label="Enabled" value={String(enabledCount)} />
          <MetricItem label="SSL" value={formatSslStatus(status?.ssl_status)} color={SSL_COLORS[status?.ssl_status ?? 'none']} />
          <MetricItem label="Provider" value={formatProvider(status?.ssl_provider)} />
        </div>
      </div>

      {/* Process Log Panel */}
      {(actionInProgress || processLog) && (
        <LogPanel
          actionInProgress={actionInProgress}
          processLog={processLog}
          onClose={onClearLog}
        />
      )}

      {/* Quick Nav Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <QuickCard
          icon={Server} label="Proxy Hosts" count={proxyCount} color="#3b82f6"
          onClick={() => onNavigate('hosts')}
        />
        <QuickCard
          icon={ArrowLeftRight} label="Redirections" count={redirectCount} color="#a855f7"
          onClick={() => onNavigate('redirects')}
        />
        <QuickCard
          icon={Ban} label="404 Hosts" count={notfoundCount} color="#f59e0b"
          onClick={() => onNavigate('404_hosts')}
        />
        <QuickCard
          icon={ShieldCheck} label="SSL / Certs" count={0} color="#22c55e"
          onClick={() => onNavigate('certificates')}
        />
      </div>

      {/* Recent Hosts */}
      {hosts.length > 0 && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Recent Hosts
            </span>
            <button
              onClick={() => onNavigate('hosts')}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {hosts.slice(0, 5).map(host => (
            <div
              key={host.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: host.enabled ? '#22c55e' : '#6b7280',
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {host.domain_names[0]}
              </span>
              <TypeBadge type={host.host_type} />
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}>
                {host.host_type === 'proxy' && host.forward_host
                  ? `${host.forward_host}:${host.forward_port ?? 80}`
                  : host.host_type === 'redirect'
                    ? host.redirect_url ?? ''
                    : ''}
              </span>
              <SslBadge mode={host.ssl_mode} />
            </div>
          ))}
        </div>
      )}

      {hosts.length === 0 && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.02))',
          padding: 32,
          textAlign: 'center',
        }}>
          <Globe size={36} style={{ color: '#3b82f6', marginBottom: 12 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', fontFamily: 'var(--font-sans)' }}>
            Get Started
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px' }}>
            Create your first proxy host to route traffic to your services.
          </p>
          <button
            onClick={() => onNavigate('hosts')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 24px',
              background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Add Proxy Host <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function QuickCard({ icon: Icon, label, count, color, onClick }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; count: number; color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '16px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'border-color var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color + '66'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
        {count}
      </span>
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    proxy: { label: 'PROXY', color: '#3b82f6' },
    redirect: { label: 'REDIR', color: '#a855f7' },
    '404_host': { label: '404', color: '#f59e0b' },
  };
  const c = config[type] ?? { label: type, color: '#6b7280' };
  return (
    <span style={{
      fontSize: '0.5625rem', fontWeight: 700,
      padding: '2px 6px', borderRadius: 4,
      background: c.color + '1a', color: c.color,
      letterSpacing: '0.03em',
    }}>
      {c.label}
    </span>
  );
}

function SslBadge({ mode }: { mode: string }) {
  if (mode === 'none') return null;
  const color = mode === 'auto' ? '#22c55e' : '#3b82f6';
  return (
    <span style={{
      fontSize: '0.5625rem', fontWeight: 700,
      padding: '2px 6px', borderRadius: 4,
      background: color + '1a', color,
    }}>
      SSL
    </span>
  );
}

function MetricItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: color ?? 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
        {value}
      </div>
    </div>
  );
}

const SSL_COLORS: Record<string, string> = {
  none: '#6b7280', pending: '#f59e0b', active: '#22c55e', expired: '#f43f5e',
};

function formatSslStatus(s?: string) {
  return (s ?? 'none').charAt(0).toUpperCase() + (s ?? 'none').slice(1);
}

function formatProvider(provider?: string) {
  switch (provider) {
    case 'letsencrypt': return "Let's Encrypt";
    case 'zerossl': return 'ZeroSSL';
    case 'self_signed': return 'Self-signed';
    case 'custom': return 'Custom';
    default: return 'None';
  }
}

// ─── Log Panel ───────────────────────────────────────────────────────

function LogPanel({ actionInProgress, processLog, onClose }: {
  actionInProgress: 'start' | 'stop' | null;
  processLog: ProcessLog | null;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [processLog, actionInProgress]);

  const isRunning = !!actionInProgress;
  const borderColor = isRunning
    ? 'rgba(59, 130, 246, 0.4)'
    : processLog?.success ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${borderColor}`,
      background: 'rgba(0, 0, 0, 0.3)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {isRunning
              ? `${actionInProgress === 'start' ? 'Starting' : 'Stopping'} Caddy...`
              : processLog?.success ? 'Completed' : 'Failed'}
          </span>
          {isRunning && <Loader2 size={12} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />}
        </div>
        {!isRunning && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: 2,
            cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div ref={scrollRef} style={{
        padding: '10px 14px', maxHeight: 180, overflowY: 'auto',
        fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', lineHeight: 1.7,
      }}>
        {isRunning && !processLog && (
          <div style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: '#6b7280' }}>$</span> caddy {actionInProgress}...
          </div>
        )}
        {processLog?.logs.map((line, i) => (
          <div key={i} style={{
            color: line.startsWith('ERROR') ? '#ef4444'
              : line.startsWith('[WARN]') ? '#f59e0b'
              : line.includes('successfully') ? '#22c55e'
              : 'var(--text-muted)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

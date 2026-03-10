import { Cable, ArrowRight } from 'lucide-react';
import type { VpnStatus } from '../hooks/use-vpn';
import type { WgEasyStatus } from '../hooks/use-wg-easy';

interface OverviewSectionProps {
  status: VpnStatus | null;
  loading: boolean;
  wgEasyStatus: WgEasyStatus | null;
  onOpenPanel: () => void;
}

export function OverviewSection({ status, loading, wgEasyStatus, onOpenPanel }: OverviewSectionProps) {
  if (loading) {
    return <LoadingState />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      {/* WireGuard Panel Card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06), rgba(124, 58, 237, 0.02))',
        padding: 24,
        marginBottom: 20,
        textAlign: 'center',
      }}>
        <Cable size={36} style={{ color: '#7c3aed', marginBottom: 12 }} />
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)',
          margin: '0 0 6px', fontFamily: 'var(--font-sans)',
        }}>
          WireGuard VPN Management
        </h2>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.8125rem',
          margin: '0 0 20px', lineHeight: 1.5,
        }}>
          Manage peers, configuration, and monitoring through the WireGuard panel.
        </p>
        <button
          onClick={onOpenPanel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 28px',
            background: '#7c3aed',
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
          Open WireGuard Panel
          <ArrowRight size={16} />
        </button>
        {wgEasyStatus && (
          <div style={{
            marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16,
            fontSize: '0.75rem', color: 'var(--text-muted)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: wgEasyStatus.running ? '#22c55e' : '#6b7280',
              }} />
              {wgEasyStatus.running ? 'Running' : wgEasyStatus.installed ? 'Stopped' : 'Not installed'}
            </span>
            <span>Port: 51820</span>
            {wgEasyStatus.ram_mb != null && (
              <span>RAM: {wgEasyStatus.ram_mb} MB</span>
            )}
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${status?.enabled ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        background: status?.enabled
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))'
          : 'var(--surface)',
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: status?.enabled ? '#22c55e' : '#6b7280',
            boxShadow: status?.enabled ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
          }} />
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {status?.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <MetricItem label="Interface" value={status?.interface ?? 'wg0'} />
          <MetricItem label="Port" value={String(status?.listen_port ?? 51820)} />
          <MetricItem label="Peers" value={String(status?.peers_count ?? 0)} />
          <MetricItem label="Subnet" value={status?.subnet ?? '10.13.13.0/24'} />
        </div>
      </div>
    </div>
  );
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

function LoadingState() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
    }}>
      Loading VPN status...
    </div>
  );
}

import { useVpnStats } from '../hooks/use-vpn-stats';
import { TransferChart } from '../components/TransferChart';
import type { VpnPeer } from '../hooks/use-vpn';

interface MonitoringSectionProps {
  peers: VpnPeer[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function getStatus(peer: VpnPeer): { label: string; color: string } {
  if (!peer.last_handshake) return { label: 'Offline', color: '#6b7280' };
  const diff = Date.now() - new Date(peer.last_handshake).getTime();
  if (diff < 180_000) return { label: 'Online', color: '#22c55e' };
  if (diff < 900_000) return { label: 'Recent', color: '#f59e0b' };
  return { label: 'Offline', color: '#6b7280' };
}

export function MonitoringSection({ peers }: MonitoringSectionProps) {
  const { snapshots, loading } = useVpnStats(24);

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
        Monitoring
      </h2>

      {/* Bandwidth Chart */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        padding: 16,
        marginBottom: 20,
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px', fontFamily: 'var(--font-sans)' }}>
          Bandwidth (Last 24h)
        </h3>
        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Loading stats...
          </div>
        ) : (
          <TransferChart snapshots={snapshots} peers={peers} />
        )}
      </div>

      {/* Current Session Stats Table */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)',
        }}>
          Current Session
        </div>

        {peers.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No peers
          </div>
        ) : (
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Peer</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>RX</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>TX</th>
                <th style={thStyle}>Last Handshake</th>
              </tr>
            </thead>
            <tbody>
              {peers.map(peer => {
                const status = getStatus(peer);
                return (
                  <tr key={peer.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{peer.name}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
                        <span style={{ color: status.color }}>{status.label}</span>
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
                      {formatBytes(peer.transfer_rx)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
                      {formatBytes(peer.transfer_tx)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                      {timeAgo(peer.last_handshake)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 14px',
  textAlign: 'left',
  fontWeight: 500,
  color: 'var(--text-muted)',
  fontSize: '0.6875rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 14px',
  color: 'var(--text-dim)',
};

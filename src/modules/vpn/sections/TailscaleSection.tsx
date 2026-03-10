import { Loader2, ExternalLink, LogOut, Download, Globe } from 'lucide-react';
import type { TailscaleStatus, TailscalePeer } from '../hooks/use-tailscale';

interface TailscaleSectionProps {
  status: TailscaleStatus | null;
  loading: boolean;
  acting: boolean;
  onInstall: () => Promise<void>;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function TailscaleSection({ status, loading, acting, onInstall, onLogin, onLogout }: TailscaleSectionProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading Tailscale status...
      </div>
    );
  }

  // Not installed
  if (!status?.installed) {
    return (
      <div style={{ padding: 24, maxWidth: 600 }}>
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface)',
          padding: 32,
          textAlign: 'center',
        }}>
          <Globe size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>
            Tailscale
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 20px', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
            Tailscale creates a secure mesh VPN network using WireGuard. Connect your devices
            without exposing ports or managing complex firewall rules.
          </p>
          <button
            onClick={onInstall}
            disabled={acting}
            style={{
              height: 38, padding: '0 24px',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: acting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {acting ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Installing...</>
            ) : (
              <><Download size={16} /> Install Tailscale</>
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Installed but not running
  if (!status.running) {
    return (
      <div style={{ padding: 24, maxWidth: 600 }}>
        <StatusCard status={status} />
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
            Tailscale daemon is not running.
          </p>
          <button
            onClick={onLogin}
            disabled={acting}
            style={primaryBtnStyle}
          >
            Start & Login
          </button>
        </div>
      </div>
    );
  }

  // Running but not logged in
  if (!status.logged_in) {
    return (
      <div style={{ padding: 24, maxWidth: 600 }}>
        <StatusCard status={status} />
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
            Tailscale is running but not logged in.
          </p>
          <button
            onClick={onLogin}
            disabled={acting}
            style={primaryBtnStyle}
          >
            {acting ? 'Starting login...' : 'Login to Tailscale'}
          </button>
        </div>
      </div>
    );
  }

  // Fully ready
  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
        Tailscale
      </h2>

      {/* Status Card */}
      <StatusCard status={status} />

      {/* Peer list */}
      {status.peers.length > 0 && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface)',
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--text)', fontFamily: 'var(--font-sans)',
          }}>
            Network Peers ({status.peers.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {status.peers.map((peer, i) => (
              <TailscalePeerRow key={i} peer={peer} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href="https://login.tailscale.com/admin"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 34, padding: '0 16px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', color: 'var(--text)',
            textDecoration: 'none', fontFamily: 'var(--font-sans)',
          }}
        >
          <ExternalLink size={14} /> Admin Console
        </a>
        <button
          onClick={onLogout}
          disabled={acting}
          style={{
            height: 34, padding: '0 16px',
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', color: '#ef4444',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
}

function StatusCard({ status }: { status: TailscaleStatus }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
      padding: 16,
      marginBottom: 20,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <InfoItem label="Status" value={status.logged_in ? 'Connected' : status.running ? 'Running' : 'Stopped'} color={status.logged_in ? '#22c55e' : status.running ? '#f59e0b' : '#6b7280'} />
        {status.ip && <InfoItem label="Tailscale IP" value={status.ip} mono />}
        {status.hostname && <InfoItem label="Hostname" value={status.hostname} />}
        {status.tailnet && <InfoItem label="Tailnet" value={status.tailnet} />}
        {status.version && <InfoItem label="Version" value={status.version} />}
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.8125rem', fontWeight: 500,
        color: color ?? 'var(--text)',
        fontFamily: mono ? 'var(--font-mono, monospace)' : 'var(--font-sans)',
      }}>
        {value}
      </div>
    </div>
  );
}

function TailscalePeerRow({ peer }: { peer: TailscalePeer }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      fontSize: '0.8125rem',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: peer.online ? '#22c55e' : '#6b7280',
        flexShrink: 0,
      }} />
      <span style={{ fontWeight: 500, color: 'var(--text)', flex: 1, fontFamily: 'var(--font-sans)' }}>
        {peer.hostname}
      </span>
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {peer.ip}
      </span>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 50 }}>
        {peer.os}
      </span>
      {peer.is_exit_node && (
        <span style={{
          fontSize: '0.5625rem', padding: '1px 6px',
          background: 'rgba(139, 92, 246, 0.15)',
          color: '#8b5cf6', borderRadius: 'var(--radius-full)',
        }}>
          EXIT
        </span>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 20px',
  background: 'var(--amber)', color: '#06060a',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

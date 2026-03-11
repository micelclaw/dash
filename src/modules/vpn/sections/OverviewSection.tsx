import { useState, useEffect, useRef } from 'react';
import { Cable, Globe, ArrowRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';
import type { VpnStatus } from '../hooks/use-vpn';
import type { TailscaleStatus } from '../hooks/use-tailscale';
import type { WgEasyStatus } from '../hooks/use-wg-easy';

interface OverviewSectionProps {
  vpnStatus: VpnStatus | null;
  tailscaleStatus: TailscaleStatus | null;
  loading: boolean;
  wgEasyStatus: WgEasyStatus | null;
  wgEasyStarting: boolean;
  onOpenPanel: () => void;
  onGoTailscale: () => void;
  onWgStart: () => Promise<void>;
  onWgStop: () => Promise<void>;
  onTailscaleInstall: () => Promise<void>;
  onTailscaleLogin: () => Promise<void>;
  onTailscaleLogout: () => Promise<void>;
  tailscaleActing: boolean;
  onRefreshVpn: () => void;
}

export function OverviewSection({
  vpnStatus, tailscaleStatus, loading, wgEasyStatus, wgEasyStarting,
  onOpenPanel, onGoTailscale, onWgStart, onWgStop,
  onTailscaleInstall, onTailscaleLogin, onTailscaleLogout, tailscaleActing,
  onRefreshVpn,
}: OverviewSectionProps) {
  if (loading) return <LoadingState />;

  const wgRunning = wgEasyStatus?.running ?? false;
  const wgActive = (vpnStatus?.enabled ?? false) && wgRunning;
  const tsInstalled = tailscaleStatus?.installed ?? false;
  const tsLoggedIn = tailscaleStatus?.logged_in ?? false;

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 20px', fontFamily: 'var(--font-sans)',
      }}>
        VPN Overview
      </h2>

      {wgEasyStatus?.wsl2_restart_needed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#f59e0b', fontSize: '0.8125rem',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>WSL2 restart needed</strong> — Mirrored networking has been configured but requires a restart.
            Close all terminals and restart your computer, or search "PowerShell" in the Start Menu and run <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>wsl --shutdown</code>.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* WireGuard Card */}
        <ServiceCard
          icon={<Cable size={24} style={{ color: '#7c3aed' }} />}
          title="WireGuard"
          running={wgActive}
          installed={wgEasyStatus?.installed ?? false}
          toggling={wgEasyStarting}
          onToggle={wgRunning ? onWgStop : onWgStart}
          serviceName="wg-easy"
          onToggleDone={onRefreshVpn}
          metrics={[
            { label: 'Interface', value: vpnStatus?.interface ?? 'wg0' },
            { label: 'Status', value: wgActive ? 'Active' : wgRunning ? 'Interface down' : 'Inactive', color: wgActive ? '#22c55e' : wgRunning ? '#f59e0b' : '#6b7280' },
            { label: 'Port', value: String(vpnStatus?.listen_port ?? 51820) },
            { label: 'Peers', value: String(vpnStatus?.peers_count ?? 0) },
            { label: 'Subnet', value: vpnStatus?.subnet ?? '10.13.13.0/24' },
            { label: 'Reachable', value: wgEasyStatus?.endpoint_reachable ? (wgEasyStatus.endpoint_method === 'upnp' ? 'UPnP' : wgEasyStatus.endpoint_method === 'domain' ? 'Domain' : 'Direct') : 'Not reachable', color: wgEasyStatus?.endpoint_reachable ? '#22c55e' : '#ef4444' },
          ]}
          action={
            <button onClick={onOpenPanel} style={actionBtnStyle('#7c3aed')}>
              Open Panel <ArrowRight size={14} />
            </button>
          }
          statusExtra={wgEasyStatus && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
              wg-easy: {wgEasyStatus.running ? 'running' : wgEasyStatus.installed ? 'stopped' : 'not installed'}
              {wgEasyStatus.ram_mb != null && ` · ${wgEasyStatus.ram_mb} MB`}
            </div>
          )}
        />

        {/* Tailscale Card */}
        <ServiceCard
          icon={<Globe size={24} style={{ color: '#3b82f6' }} />}
          title="Tailscale"
          running={tsLoggedIn}
          installed={tsInstalled}
          toggling={tailscaleActing}
          onToggle={!tsInstalled ? onTailscaleInstall : tsLoggedIn ? onTailscaleLogout : onTailscaleLogin}
          serviceName="tailscale"
          onToggleDone={onRefreshVpn}
          metrics={[
            { label: 'Status', value: !tsInstalled ? 'Not installed' : tsLoggedIn ? 'Connected' : tailscaleStatus?.running ? 'Not logged in' : 'Stopped', color: tsLoggedIn ? '#22c55e' : tailscaleStatus?.running ? '#f59e0b' : '#6b7280' },
            ...(tailscaleStatus?.ip ? [{ label: 'Tailscale IP', value: tailscaleStatus.ip }] : []),
            ...(tailscaleStatus?.hostname ? [{ label: 'Hostname', value: tailscaleStatus.hostname }] : []),
            ...(tailscaleStatus?.tailnet ? [{ label: 'Tailnet', value: tailscaleStatus.tailnet }] : []),
            ...(tailscaleStatus?.version ? [{ label: 'Version', value: tailscaleStatus.version }] : []),
            ...(tailscaleStatus?.peers ? [{ label: 'Peers', value: String(tailscaleStatus.peers.length) }] : []),
          ]}
          action={
            <button onClick={onGoTailscale} style={actionBtnStyle('#3b82f6')}>
              {tsInstalled ? 'Manage' : 'Install'} <ArrowRight size={14} />
            </button>
          }
        />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

interface Metric {
  label: string;
  value: string;
  color?: string;
}

function ServiceCard({ icon, title, running, installed, toggling, onToggle, serviceName, onToggleDone, metrics, action, statusExtra }: {
  icon: React.ReactNode;
  title: string;
  running: boolean;
  installed: boolean;
  toggling: boolean;
  onToggle: () => void;
  serviceName: string;
  onToggleDone?: () => void;
  metrics: Metric[];
  action: React.ReactNode;
  statusExtra?: React.ReactNode;
}) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const prevTogglingRef = useRef(false);
  const wasStartingRef = useRef(false);
  const wsEvent = useWebSocket('service.logs');

  // Auto-open logs when toggling starts
  useEffect(() => {
    if (toggling && !prevTogglingRef.current) {
      wasStartingRef.current = !running;
      setShowLogs(true);
      setLogs([`[${new Date().toLocaleTimeString()}] ${running ? 'Stopping' : 'Starting'} ${title}...`]);
    }
    // Add completion line when toggling ends
    if (!toggling && prevTogglingRef.current) {
      const label = wasStartingRef.current ? 'Ready' : 'Stopped';
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${label}`]);
      onToggleDone?.();
    }
    prevTogglingRef.current = toggling;
  }, [toggling]);

  // Collect log lines from WS
  useEffect(() => {
    if (!wsEvent?.data) return;
    const data = wsEvent.data as Record<string, unknown>;
    if (data.service !== serviceName) return;
    const lines = data.lines as string[] | undefined;
    if (lines?.length) {
      setLogs(prev => [...prev, ...lines].slice(-100));
    }
  }, [wsEvent, serviceName]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const borderColor = running ? 'rgba(34, 197, 94, 0.3)'
    : installed ? 'rgba(245, 158, 11, 0.3)'
    : 'var(--border)';

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${borderColor}`,
      background: 'var(--surface)',
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <span style={{
          fontSize: '1rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)',
        }}>
          {title}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status dot */}
          <span
            title={running ? 'Running' : installed ? 'Installed · Not running' : 'Not installed'}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: running ? '#22c55e' : installed ? '#f59e0b' : '#6b7280',
              boxShadow: running ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none',
              cursor: 'help',
            }}
          />
          {/* Toggle switch */}
          <button
            onClick={onToggle}
            disabled={toggling}
            title={running ? 'Turn off' : 'Turn on'}
            style={{
              position: 'relative',
              width: 36, height: 20,
              borderRadius: 10,
              border: 'none',
              background: toggling ? '#6b7280' : running ? '#22c55e' : '#374151',
              cursor: toggling ? 'wait' : 'pointer',
              transition: 'background 0.2s',
              padding: 0,
              opacity: toggling ? 0.7 : 1,
            }}
          >
            <span style={{
              position: 'absolute',
              top: 2, left: running ? 18 : 2,
              width: 16, height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px',
      }}>
        {metrics.map(m => (
          <div key={m.label}>
            <div style={{
              fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--text-muted)', marginBottom: 1,
            }}>
              {m.label}
            </div>
            <div style={{
              fontSize: '0.8125rem', fontWeight: 500,
              color: m.color ?? 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {statusExtra}

      {/* Log panel */}
      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontSize: '0.6875rem',
              cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)',
            }}
          >
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Logs ({logs.length})
          </button>
          {showLogs && (
            <div
              ref={logRef}
              style={{
                marginTop: 6,
                maxHeight: 140,
                overflow: 'auto',
                background: '#0a0a0f',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono, monospace)',
                color: '#a1a1aa',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {toggling && (
                <div style={{ color: '#f59e0b' }}>...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action */}
      <div style={{ marginTop: 'auto' }}>
        {action}
      </div>
    </div>
  );
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'opacity var(--transition-fast)',
    width: '100%',
    justifyContent: 'center',
  };
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

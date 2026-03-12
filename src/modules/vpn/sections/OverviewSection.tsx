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

import { useState, useEffect, useRef } from 'react';
import { Cable, Globe, ArrowRight, ChevronDown, ChevronUp, AlertTriangle, Download, ShieldCheck } from 'lucide-react';
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
  const showHttpsCard = (wgEasyStatus?.endpoint_reachable && wgRunning) || tsLoggedIn;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
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
            { label: 'Port', value: String(vpnStatus?.listen_port ?? 48291) },
            { label: 'Peers', value: String(vpnStatus?.peers_count ?? 0) },
            { label: 'Subnet', value: vpnStatus?.subnet ?? '10.13.13.0/24' },
            { label: 'Reachable', value: wgEasyStatus?.endpoint_reachable ? (wgEasyStatus.endpoint_method === 'upnp' ? 'UPnP' : wgEasyStatus.endpoint_method === 'domain' ? 'Domain' : 'Direct') : wgRunning ? 'Unverified' : 'Not reachable', color: wgEasyStatus?.endpoint_reachable ? '#22c55e' : wgRunning ? '#f59e0b' : '#ef4444' },
          ]}
          action={
            <button onClick={onOpenPanel} style={actionBtnStyle('#7c3aed')}>
              Open Panel <ArrowRight size={14} />
            </button>
          }
          statusExtra={wgEasyStatus && (
            <>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                wg-easy: {wgEasyStatus.running ? 'running' : wgEasyStatus.installed ? 'stopped' : 'not installed'}
                {wgEasyStatus.ram_mb != null && ` · ${wgEasyStatus.ram_mb} MB`}
              </div>
              {wgEasyStatus.endpoint_reachable && wgEasyStatus.running && wgEasyStatus.server_vpn_ip && (() => {
                const p = window.location.port;
                const proto = window.location.protocol === 'https:' ? 'https' : 'http';
                const ipUrl = p ? `${proto}://${wgEasyStatus.server_vpn_ip}:${p}` : `${proto}://${wgEasyStatus.server_vpn_ip}`;
                return (
                  <MobileAccessTip label="WireGuard" urls={[
                      { url: ipUrl, note: 'VPN IP' },
                      { url: `https://yourdomain.com${p ? `:${p}` : ''}`, note: 'if you configured a domain' },
                    ]} />
                );
              })()}
              {!wgEasyStatus.endpoint_reachable && wgEasyStatus.running && (
                <PortForwardingHelp localIp={wgEasyStatus.local_ip} port={vpnStatus?.listen_port ?? 48291} />
              )}
            </>
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
          statusExtra={tsLoggedIn && tailscaleStatus && (() => {
            const p = window.location.port;
            const proto = window.location.protocol === 'https:' ? 'https' : 'http';
            const urls: { url: string; note?: string }[] = [];
            // HTTPS via Tailscale cert domain (hostname.tailnet.ts.net)
            if (tailscaleStatus.https_cert?.domain) {
              urls.push({ url: `https://${tailscaleStatus.https_cert.domain}${p ? `:${p}` : ''}`, note: 'HTTPS' });
            } else if (tailscaleStatus.hostname && tailscaleStatus.tailnet) {
              urls.push({ url: `${proto}://${tailscaleStatus.hostname}.${tailscaleStatus.tailnet}.ts.net${p ? `:${p}` : ''}`, note: 'Tailnet DNS' });
            }
            // Tailscale IP
            if (tailscaleStatus.ip) {
              urls.push({ url: `${proto}://${tailscaleStatus.ip}${p ? `:${p}` : ''}`, note: 'Tailscale IP' });
            }
            // Custom domain hint
            urls.push({ url: `https://yourdomain.com${p ? `:${p}` : ''}`, note: 'if you configured a domain' });
            return urls.length > 0 ? <MobileAccessTip label="Tailscale" urls={urls} /> : null;
          })()}
        />

        {/* HTTPS Certificate Card */}
        {showHttpsCard && <HttpsSetupCard />}
      </div>
    </div>
  );
}

/* ── Mobile Access Tip (shown when VPN is reachable) ──── */

const urlCodeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 4,
  fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem',
  color: '#22c55e', userSelect: 'all', cursor: 'text',
};

function MobileAccessTip({ urls, label }: { urls: { url: string; note?: string }[]; label: string }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: 'rgba(34, 197, 94, 0.08)',
      border: '1px solid rgba(34, 197, 94, 0.25)',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.6875rem', lineHeight: 1.6,
      color: 'var(--text-dim)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Cable size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
            Access the dashboard from your phone while connected to {label}:
          </div>
          {urls.map((u, i) => (
            <div key={i} style={{ marginBottom: i < urls.length - 1 ? 6 : 0 }}>
              <code style={urlCodeStyle}>{u.url}</code>
              {u.note && (
                <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginLeft: 6 }}>{u.note}</span>
              )}
            </div>
          ))}
          <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.625rem' }}>
            Tip: In your mobile browser, tap <strong style={{ color: 'var(--text-dim)' }}>Share</strong> (or menu) and select <strong style={{ color: 'var(--text-dim)' }}>Add to Home Screen</strong> / <strong style={{ color: 'var(--text-dim)' }}>Install App</strong> to pin Micelclaw OS as a native app.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── HTTPS Certificate Card ───────────────────────────── */

function HttpsSetupCard() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/v1/hal/network/proxy/ca-certificate');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'micelclaw-os-ca.crt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Last resort: open directly (works on mobile even if download attribute fails)
      window.open('/api/v1/hal/network/proxy/ca-certificate', '_blank');
    }
    setDownloading(false);
  };

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      background: 'var(--surface)',
      padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={24} style={{ color: '#f59e0b' }} />
        <span style={{
          fontSize: '1rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)',
        }}>
          HTTPS Certificate
        </span>
      </div>

      {/* Explanation */}
      <div style={{ fontSize: '0.75rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Your first connection will use <strong style={{ color: 'var(--text-dim)' }}>HTTPS</strong> with a self-signed certificate.
        The VPN tunnel already encrypts your traffic, but your browser will show a "Not Secure" warning.
        Install the CA certificate on your device to enable <strong style={{ color: '#22c55e' }}>HTTPS</strong> without warnings.
      </div>

      {/* Steps */}
      <ol style={{
        margin: 0, paddingLeft: 18,
        color: 'var(--text-muted)', fontSize: '0.625rem', lineHeight: 1.9,
      }}>
        <li>Open this page on your phone via VPN</li>
        <li>Tap the button below to download the certificate</li>
        <li>
          <strong style={{ color: 'var(--text-dim)' }}>iPhone:</strong> Settings → <em>Profile Downloaded</em> → Install →
          then General → About → <em>Certificate Trust Settings</em> → enable
        </li>
        <li>
          <strong style={{ color: 'var(--text-dim)' }}>Android:</strong> Settings → Security → <em>Install a certificate</em> → CA certificate
        </li>
      </ol>

      {/* Download button — uses fetch() + blob URL for reliable cross-browser download */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '7px 16px',
          background: '#f59e0b',
          color: '#000',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: downloading ? 'wait' : 'pointer',
          fontFamily: 'var(--font-sans)',
          width: '100%',
          opacity: downloading ? 0.7 : 1,
        }}
      >
        <Download size={14} />
        {downloading ? 'Downloading...' : 'Download CA Certificate'}
      </button>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
        This certificate is unique to your Micelclaw OS instance. Install once per device — works for both WireGuard and Tailscale connections.
      </div>
    </div>
  );
}

/* ── Port Forwarding Help ─────────────────────────────── */

const codeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3,
  fontFamily: 'var(--font-mono, monospace)', fontSize: '0.625rem',
};

const exampleBox: React.CSSProperties = {
  padding: '8px 10px', background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)',
  fontSize: '0.625rem', lineHeight: 1.7, color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono, monospace)',
};

function PortForwardingHelp({ localIp, port }: { localIp: string | null; port: number }) {
  const [showExamples, setShowExamples] = useState(false);
  const ip = localIp ?? '192.168.1.x';
  const p = String(port);

  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.6875rem', lineHeight: 1.6,
      color: 'var(--text-dim)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <strong style={{ color: '#f59e0b', fontSize: '0.75rem' }}>Port {p}/TCP+UDP — reachability unverified</strong>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        UPnP could not open the port automatically. If you have already configured port forwarding, connect a client to verify. Otherwise, forward port <strong style={{ color: 'var(--text)' }}>{p} TCP+UDP</strong> on your router to <code style={codeStyle}>{ip}</code>. The status will update to <strong style={{ color: '#22c55e' }}>Reachable</strong> once a client connects.
      </div>

      {/* Collapsible examples */}
      <button
        onClick={() => setShowExamples(!showExamples)}
        style={{
          background: 'none', border: 'none', padding: '4px 0', marginTop: 6,
          color: '#7c3aed', fontSize: '0.6875rem', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {showExamples ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showExamples ? 'Hide examples' : 'Show router examples'}
      </button>

      {showExamples && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

          {/* Generic / TP-Link style */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              TP-Link / Generic routers
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Go to <em>Forwarding &gt; Virtual Servers &gt; Add New</em>
            </div>
            <div style={exampleBox}>
              Service Port: <strong style={{ color: 'var(--text)' }}>{p}</strong><br />
              Internal Port: <strong style={{ color: 'var(--text)' }}>{p}</strong><br />
              IP Address: <strong style={{ color: 'var(--text)' }}>{ip}</strong><br />
              Protocol: <strong style={{ color: 'var(--text)' }}>TCP+UDP</strong><br />
              Status: <strong style={{ color: 'var(--text)' }}>Enabled</strong>
            </div>
          </div>

          {/* ZTE / ISP branded */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              ZTE / ISP-branded routers (e.g. Movistar, Vodafone)
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Go to <em>Application &gt; Port Forwarding &gt; Create New</em>
            </div>
            <div style={exampleBox}>
              Name: <strong style={{ color: 'var(--text)' }}>Wireguard</strong><br />
              Protocol: <strong style={{ color: 'var(--text)' }}>TCP+UDP</strong><br />
              WAN Host IP: <strong style={{ color: 'var(--text)' }}>0.0.0.0 ~ 0.0.0.0</strong> (leave empty or all zeros)<br />
              LAN Host: <strong style={{ color: 'var(--text)' }}>{ip}</strong><br />
              WAN Port: <strong style={{ color: 'var(--text)' }}>{p} ~ {p}</strong><br />
              LAN Host Port: <strong style={{ color: 'var(--text)' }}>{p} ~ {p}</strong><br />
              Status: <strong style={{ color: 'var(--text)' }}>Enabled</strong>
            </div>
          </div>

          {/* FRITZ!Box */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              FRITZ!Box
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Go to <em>Internet &gt; Permit Access &gt; Port Sharing &gt; New Sharing</em>
            </div>
            <div style={exampleBox}>
              Device: <strong style={{ color: 'var(--text)' }}>{ip}</strong> (select your server)<br />
              Application: <strong style={{ color: 'var(--text)' }}>Other application</strong><br />
              Name: <strong style={{ color: 'var(--text)' }}>WireGuard</strong><br />
              Protocol: <strong style={{ color: 'var(--text)' }}>TCP+UDP</strong><br />
              Port to device: <strong style={{ color: 'var(--text)' }}>{p}</strong><br />
              Port requested externally: <strong style={{ color: 'var(--text)' }}>{p}</strong>
            </div>
          </div>

          {/* Netgear / ASUS */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              Netgear / ASUS
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Go to <em>Advanced &gt; WAN &gt; Port Forwarding</em> (ASUS) or <em>Dynamic DNS &gt; Port Forwarding</em> (Netgear)
            </div>
            <div style={exampleBox}>
              Service Name: <strong style={{ color: 'var(--text)' }}>WireGuard</strong><br />
              Protocol: <strong style={{ color: 'var(--text)' }}>TCP+UDP</strong><br />
              External Port: <strong style={{ color: 'var(--text)' }}>{p}</strong><br />
              Internal Port: <strong style={{ color: 'var(--text)' }}>{p}</strong><br />
              Internal IP: <strong style={{ color: 'var(--text)' }}>{ip}</strong>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
        Alternatively, use <strong style={{ color: '#3b82f6' }}>Tailscale</strong> for zero-config remote access without opening any ports.
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

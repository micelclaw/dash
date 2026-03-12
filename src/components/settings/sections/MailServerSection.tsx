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
import {
  Server, Play, Square, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Copy, Eye, EyeOff, Send, ExternalLink, Shield, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

// ─── Types (mirror backend mail-server.types.ts) ─────────────────

interface DnsCheck {
  status: 'pass' | 'warning' | 'fail';
  value: string | null;
  expected: string | null;
  message: string;
}

interface DnsCheckResult {
  domain: string;
  server_ip: string;
  checked_at: string;
  checks: { mx: DnsCheck; spf: DnsCheck; dkim: DnsCheck; dmarc: DnsCheck; ptr: DnsCheck; port25: DnsCheck };
  overall: 'pass' | 'warning' | 'fail';
  recommendations: string[];
}

interface MailServerStatus {
  installed: boolean;
  running: boolean;
  hostname: string;
  domains: string[];
  mailboxes_count: number;
  clamav_enabled: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  last_dns_check: DnsCheckResult | null;
  relay: { enabled: boolean; host: string } | null;
  ports: { smtp_25: string; submission_587: string; imaps_993: string };
}

interface RelayConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'starttls' | 'none';
}

interface RelayPreset {
  name: string;
  host: string;
  port: number;
  encryption: 'tls' | 'starttls';
  username_template: string;
  free_tier: string;
}

interface MailCredentials {
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
}

// ─── Styles ──────────────────────────────────────────────────────

const S = {
  card: {
    padding: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 12,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,
  label: {
    fontSize: '0.8125rem',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
  } as React.CSSProperties,
  value: {
    fontSize: '0.8125rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
  } as React.CSSProperties,
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--amber)',
    background: 'var(--amber)',
    color: '#000',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  input: {
    height: 30,
    padding: '0 8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  } as React.CSSProperties,
  select: {
    height: 30,
    padding: '0 24px 0 8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 6px center',
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    background: `${color}20`,
    color,
  } as React.CSSProperties),
  dot: (color: string, pulse?: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
    animation: pulse ? 'pulse 2s ease-in-out infinite' : undefined,
  } as React.CSSProperties),
  muted: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  } as React.CSSProperties,
};

// ─── Helpers ─────────────────────────────────────────────────────

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DNS_CHECK_LABELS: Record<string, string> = {
  mx: 'MX Record',
  spf: 'SPF Record',
  dkim: 'DKIM Record',
  dmarc: 'DMARC Record',
  ptr: 'PTR (Reverse DNS)',
  port25: 'Port 25 (SMTP)',
};

function statusIcon(status: 'pass' | 'warning' | 'fail') {
  if (status === 'pass') return <CheckCircle2 size={14} style={{ color: 'var(--emerald, #10b981)' }} />;
  if (status === 'warning') return <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />;
  return <XCircle size={14} style={{ color: 'var(--error)' }} />;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
}

// ─── Component ───────────────────────────────────────────────────

export function MailServerSection() {
  const [status, setStatus] = useState<MailServerStatus | null>(null);
  const [dnsResult, setDnsResult] = useState<DnsCheckResult | null>(null);
  const [relay, setRelay] = useState<RelayConfig>({ enabled: false, host: '', port: 587, username: '', password: '', encryption: 'starttls' });
  const [presets, setPresets] = useState<RelayPreset[]>([]);
  const [credentials, setCredentials] = useState<MailCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('test@mail-tester.com');
  const [loading, setLoading] = useState({ status: true, dns: false, relay: false, relayTest: false, testEmail: false, start: false, stop: false });

  // ─── Fetch data ──────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: MailServerStatus }>('/mail/server/status');
      setStatus(res.data);
      if (res.data.last_dns_check) setDnsResult(res.data.last_dns_check);
    } catch {
      // Server may not have mail server routes if not configured
    } finally {
      setLoading((l) => ({ ...l, status: false }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Fetch relay config
    api.get<{ data: RelayConfig }>('/mail/server/relay').then((r) => setRelay(r.data)).catch(() => {});
    api.get<{ data: Record<string, RelayPreset> }>('/mail/server/relay/presets').then((r) => {
      setPresets(Object.values(r.data));
    }).catch(() => {});
    api.get<{ data: MailCredentials }>('/mail/server/credentials').then((r) => setCredentials(r.data)).catch(() => {});
  }, [fetchStatus]);

  // ─── Actions ─────────────────────────────────────────────

  const handleStart = async () => {
    setLoading((l) => ({ ...l, start: true }));
    toast.info('Starting mail server — this may take a few minutes on first install...');
    try {
      await api.post('/mail/server/start');
      toast.success('Mail server started');
      await fetchStatus();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      toast.error(msg && msg !== 'Request failed' ? msg : 'Failed to start mail server. Check server logs for details.');
      // Still try to refresh status — the container might have started
      setTimeout(fetchStatus, 3000);
    } finally {
      setLoading((l) => ({ ...l, start: false }));
    }
  };

  const handleStop = async () => {
    setLoading((l) => ({ ...l, stop: true }));
    try {
      await api.post('/mail/server/stop');
      toast.success('Mail server stopped');
      await fetchStatus();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to stop mail server');
    } finally {
      setLoading((l) => ({ ...l, stop: false }));
    }
  };

  const handleDnsCheck = async () => {
    setLoading((l) => ({ ...l, dns: true }));
    try {
      const res = await api.post<{ data: DnsCheckResult }>('/mail/server/dns-check');
      setDnsResult(res.data);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'DNS check failed');
    } finally {
      setLoading((l) => ({ ...l, dns: false }));
    }
  };

  const handleSaveRelay = async () => {
    setLoading((l) => ({ ...l, relay: true }));
    try {
      await api.put('/mail/server/relay', relay);
      toast.success('Relay configuration saved');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save relay config');
    } finally {
      setLoading((l) => ({ ...l, relay: false }));
    }
  };

  const handleTestRelay = async () => {
    setLoading((l) => ({ ...l, relayTest: true }));
    try {
      const res = await api.post<{ data: { success: boolean; error?: string } }>('/mail/server/relay/test', { email: testEmail });
      if (res.data.success) {
        toast.success('Test email sent via relay');
      } else {
        toast.error(res.data.error || 'Relay test failed');
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Relay test failed');
    } finally {
      setLoading((l) => ({ ...l, relayTest: false }));
    }
  };

  const handleTestEmail = async () => {
    setLoading((l) => ({ ...l, testEmail: true }));
    try {
      const res = await api.post<{ data: { success: boolean; message_id: string | null; error: string | null } }>('/mail/server/test-email', { email: testEmail });
      if (res.data.success) {
        toast.success(`Test email sent (ID: ${res.data.message_id})`);
      } else {
        toast.error(res.data.error || 'Failed to send test email');
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to send test email');
    } finally {
      setLoading((l) => ({ ...l, testEmail: false }));
    }
  };

  const applyPreset = (presetName: string) => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
      setRelay((r) => ({
        ...r,
        host: preset.host,
        port: preset.port,
        encryption: preset.encryption,
        username: '',
        password: '',
      }));
    }
  };

  // ─── Loading state ────────────────────────────────────────

  if (loading.status) {
    return (
      <SettingSection title="Mail Server" description="Self-hosted email server (Poste.io).">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>Loading mail server status...</span>
        </div>
      </SettingSection>
    );
  }

  // ─── Not installed CTA ────────────────────────────────────

  if (!status || !status.installed) {
    return (
      <SettingSection title="Mail Server" description="Self-hosted email server powered by Poste.io.">
        <div
          style={{
            ...S.card,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <Server size={32} style={{ color: 'var(--text-muted)' }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', margin: '0 0 4px 0', fontFamily: 'var(--font-sans)' }}>
              Set up your own mail server
            </p>
            <p style={S.muted}>
              Send and receive email from your own domain. Includes SMTP, IMAP, antispam, and DKIM signing.
            </p>
          </div>
          <button
            style={S.btnPrimary}
            onClick={handleStart}
            disabled={loading.start}
          >
            {loading.start ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Install & Start
          </button>
          <p style={S.muted}>Requires ~768 MB RAM. Pro tier recommended.</p>
        </div>
      </SettingSection>
    );
  }

  // ─── Main UI ───────────────────────────────────────────────

  const adminUrl = 'http://localhost:8880';

  return (
    <>
      {/* ── Status ──────────────────────────────────────── */}
      <SettingSection
        title="Mail Server"
        description="Self-hosted email server powered by Poste.io."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {status.running ? (
              <button style={S.btn} onClick={handleStop} disabled={loading.stop}>
                {loading.stop ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                Stop
              </button>
            ) : (
              <button style={S.btn} onClick={handleStart} disabled={loading.start}>
                {loading.start ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Start
              </button>
            )}
            <button style={S.btn} onClick={fetchStatus}>
              <RefreshCw size={14} />
            </button>
          </div>
        }
      >
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={S.dot(status.running ? 'var(--emerald, #10b981)' : 'var(--text-muted)', status.running ? false : false)} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {status.running ? 'Running' : 'Stopped'}
            </span>
            {status.clamav_enabled && (
              <span style={S.badge('var(--emerald, #10b981)')}>
                <Shield size={10} /> ClamAV
              </span>
            )}
          </div>

          <div style={S.row}>
            <span style={S.label}>Hostname</span>
            <span style={S.value}>{status.hostname || '--'}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Domains</span>
            <span style={S.value}>{status.domains.length > 0 ? status.domains.join(', ') : '--'}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>Mailboxes</span>
            <span style={S.value}>{status.mailboxes_count}</span>
          </div>
          <div style={S.row}>
            <span style={S.label}>RAM</span>
            <span style={S.value}>{status.ram_mb !== null ? `${status.ram_mb} MB` : '--'}</span>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>Uptime</span>
            <span style={S.value}>{formatUptime(status.uptime_seconds)}</span>
          </div>

          {status.relay && status.relay.enabled && (
            <div style={{ marginTop: 8, ...S.badge('var(--amber)') }}>
              Relay: {status.relay.host}
            </div>
          )}
        </div>

        {adminUrl && (
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...S.btn,
              textDecoration: 'none',
              display: 'inline-flex',
              marginTop: 4,
              padding: '8px 32px',
              background: '#16a34a',
              color: '#fff',
              border: '1px solid #15803d',
            }}
          >
            <ExternalLink size={14} />
            Open Admin Panel
          </a>
        )}
      </SettingSection>

      {/* ── DNS Health Check ──────────────────────────────── */}
      {status.running && (
        <SettingSection
          title="DNS Health Check"
          description="Verify DNS records for email deliverability."
          action={
            <button style={S.btn} onClick={handleDnsCheck} disabled={loading.dns}>
              {loading.dns ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Check
            </button>
          }
        >
          {dnsResult ? (
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {statusIcon(dnsResult.overall)}
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                  {dnsResult.overall === 'pass' ? 'All checks passed' : dnsResult.overall === 'warning' ? 'Some warnings' : 'Issues found'}
                </span>
                <span style={S.muted}>
                  {dnsResult.domain} &middot; {new Date(dnsResult.checked_at).toLocaleTimeString()}
                </span>
              </div>

              {Object.entries(dnsResult.checks).map(([key, check]) => (
                <div key={key} style={{ ...S.row, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {statusIcon(check.status)}
                    <span style={S.label}>{DNS_CHECK_LABELS[key] || key}</span>
                  </div>
                  <span style={{ ...S.value, fontSize: '0.75rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {check.value || check.message}
                  </span>
                </div>
              ))}

              {dnsResult.recommendations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ ...S.label, fontWeight: 500, marginBottom: 6 }}>Recommendations:</p>
                  {dnsResult.recommendations.map((rec, i) => (
                    <p key={i} style={{ ...S.muted, padding: '4px 0', lineHeight: 1.4 }}>
                      {i + 1}. {rec}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={S.muted}>No DNS check results yet. Click "Check" to verify your DNS records.</p>
          )}
        </SettingSection>
      )}

      {/* ── SMTP Relay ────────────────────────────────────── */}
      {status.running && (
        <SettingSection
          title="SMTP Relay"
          description="Route outbound email through an external SMTP relay. Useful when port 25 is blocked by your ISP."
        >
          <div style={S.card}>
            {/* Enable toggle */}
            <div style={{ ...S.row, borderBottom: relay.enabled ? '1px solid var(--border)' : 'none' }}>
              <span style={S.label}>Enable SMTP Relay</span>
              <button
                onClick={() => setRelay((r) => ({ ...r, enabled: !r.enabled }))}
                role="switch"
                aria-checked={relay.enabled}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  background: relay.enabled ? 'var(--amber)' : 'var(--surface)',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: 'inset 0 0 0 1px var(--border)',
                  transition: 'background 0.15s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: relay.enabled ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: relay.enabled ? '#000' : 'var(--text-muted)',
                    transition: 'left 0.15s',
                  }}
                />
              </button>
            </div>

            {relay.enabled && (
              <>
                {/* Preset selector */}
                {presets.length > 0 && (
                  <div style={{ ...S.row }}>
                    <span style={S.label}>Preset</span>
                    <select
                      style={S.select}
                      onChange={(e) => applyPreset(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>Select a provider...</option>
                      {presets.map((p) => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={S.row}>
                  <span style={S.label}>Host</span>
                  <input
                    style={{ ...S.input, width: 200 }}
                    value={relay.host}
                    onChange={(e) => setRelay((r) => ({ ...r, host: e.target.value }))}
                    placeholder="smtp.sendgrid.net"
                  />
                </div>

                <div style={S.row}>
                  <span style={S.label}>Port</span>
                  <input
                    style={{ ...S.input, width: 80 }}
                    type="number"
                    value={relay.port}
                    onChange={(e) => setRelay((r) => ({ ...r, port: parseInt(e.target.value) || 587 }))}
                  />
                </div>

                <div style={S.row}>
                  <span style={S.label}>Encryption</span>
                  <select
                    style={S.select}
                    value={relay.encryption}
                    onChange={(e) => setRelay((r) => ({ ...r, encryption: e.target.value as RelayConfig['encryption'] }))}
                  >
                    <option value="starttls">STARTTLS</option>
                    <option value="tls">SSL/TLS</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div style={S.row}>
                  <span style={S.label}>Username</span>
                  <input
                    style={{ ...S.input, width: 200 }}
                    value={relay.username}
                    onChange={(e) => setRelay((r) => ({ ...r, username: e.target.value }))}
                    placeholder="apikey"
                  />
                </div>

                <div style={{ ...S.row, borderBottom: 'none' }}>
                  <span style={S.label}>Password</span>
                  <input
                    style={{ ...S.input, width: 200 }}
                    type="password"
                    value={relay.password}
                    onChange={(e) => setRelay((r) => ({ ...r, password: e.target.value }))}
                    placeholder="API key or password"
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={S.btnPrimary} onClick={handleSaveRelay} disabled={loading.relay}>
                    {loading.relay ? <Loader2 size={14} className="animate-spin" /> : null}
                    Save Relay
                  </button>
                  <button style={S.btn} onClick={handleTestRelay} disabled={loading.relayTest || !relay.host}>
                    {loading.relayTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Test Relay
                  </button>
                </div>
              </>
            )}
          </div>
        </SettingSection>
      )}

      {/* ── Test Deliverability ───────────────────────────── */}
      {status.running && (
        <SettingSection
          title="Test Deliverability"
          description="Send a test email to check your mail server's deliverability score."
        >
          <div style={S.card}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...S.input, flex: 1 }}
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@mail-tester.com"
              />
              <button style={S.btnPrimary} onClick={handleTestEmail} disabled={loading.testEmail || !testEmail}>
                {loading.testEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send Test
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Mail-tester.com', url: 'https://www.mail-tester.com' },
                { label: 'MailGenius', url: 'https://www.mailgenius.com' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...S.muted, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </SettingSection>
      )}

      {/* ── Account Credentials ───────────────────────────── */}
      {status.running && credentials && (
        <SettingSection
          title="Account Credentials"
          description="IMAP and SMTP connection details for your self-hosted email."
        >
          <div style={S.card}>
            <div style={S.row}>
              <span style={S.label}>Email</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={S.value}>{credentials.email}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }} onClick={() => copyToClipboard(credentials.email)}>
                  <Copy size={12} />
                </button>
              </div>
            </div>

            <div style={S.row}>
              <span style={S.label}>IMAP</span>
              <span style={S.value}>{credentials.imap_host}:{credentials.imap_port}</span>
            </div>

            <div style={S.row}>
              <span style={S.label}>SMTP</span>
              <span style={S.value}>{credentials.smtp_host}:{credentials.smtp_port}</span>
            </div>

            <div style={S.row}>
              <span style={S.label}>Username</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={S.value}>{credentials.username}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }} onClick={() => copyToClipboard(credentials.username)}>
                  <Copy size={12} />
                </button>
              </div>
            </div>

            <div style={{ ...S.row, borderBottom: 'none' }}>
              <span style={S.label}>Password</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={S.value}>{showPassword ? credentials.password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}</span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                  onClick={() => copyToClipboard(credentials.password)}
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>
        </SettingSection>
      )}
    </>
  );
}

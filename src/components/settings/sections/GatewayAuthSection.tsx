/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { DevicesSection } from './DevicesSection';

const AUTH_MODES = [
  { value: 'token', label: 'Token', desc: 'Shared secret token (recommended)' },
  { value: 'password', label: 'Password', desc: 'Password-based authentication' },
  { value: 'none', label: 'None', desc: 'No authentication (WARNING: insecure)' },
];

const BIND_OPTIONS = [
  { value: 'loopback', label: 'Loopback only (127.0.0.1)' },
  { value: 'lan', label: 'LAN (all interfaces)' },
  { value: 'tailnet', label: 'Tailscale network' },
];

const TAILSCALE_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'serve', label: 'Serve (HTTPS via Tailscale)' },
  { value: 'funnel', label: 'Funnel (public internet via Tailscale)' },
];

const RELOAD_MODES = [
  { value: 'hybrid', label: 'Hybrid (recommended)' },
  { value: 'hot', label: 'Hot (instant, warns on restart-needed)' },
  { value: 'restart', label: 'Restart (always restart on change)' },
  { value: 'off', label: 'Off (no auto-reload)' },
];

export function GatewayAuthSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [authMode, setAuthMode] = useState('token');
  const [bind, setBind] = useState('loopback');
  const [tailscaleMode, setTailscaleMode] = useState('off');
  const [reloadMode, setReloadMode] = useState('hybrid');
  const [tlsEnabled, setTlsEnabled] = useState(false);
  const [port, setPort] = useState(18789);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getAuthConfig();
      setAuthMode(data.mode ?? 'token');
      setBind(data.bind ?? 'loopback');
      setPort(data.port ?? 18789);
      const ts = (data.tailscale ?? {}) as Record<string, unknown>;
      setTailscaleMode((ts.mode ?? 'off') as string);
      const tls = (data.tls ?? {}) as Record<string, unknown>;
      setTlsEnabled((tls.enabled ?? false) as boolean);
      const reload = (data.reload ?? {}) as Record<string, unknown>;
      setReloadMode((reload.mode ?? 'hybrid') as string);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load gateway auth config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateAuthConfig({
        mode: authMode,
        bind,
        tailscale: { mode: tailscaleMode },
        tls: { enabled: tlsEnabled },
        reload: { mode: reloadMode },
      });
      toast.success('Gateway saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update gateway config'));
    } finally {
      setSaving(false);
    }
  };

  const Select = ({ label, desc, value, options, onChange }: {
    label: string; desc: string; value: string;
    options: { value: string; label: string; desc?: string }[];
    onChange: (v: string) => void;
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        padding: '4px 8px', fontSize: '0.75rem', minWidth: 200,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}{o.desc ? ` — ${o.desc}` : ''}</option>)}
      </select>
    </div>
  );

  return (
    <SectionShell
      title="Gateway"
      description={`Authentication, network binding, TLS, and Tailscale settings. Port: ${port}. The collapsible blocks below save independently — each writes to its own config endpoint.`}
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      appliesAt="gateway-restart"
    >
      <Select label="Auth mode" desc="How clients authenticate with the Gateway" value={authMode} options={AUTH_MODES} onChange={markDirty(setAuthMode)} />

      {authMode === 'none' && (
        <div style={{ padding: '8px 12px', background: '#ef444410', border: '1px solid #ef444430', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
          <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
            Warning: No authentication. Anyone who can reach the Gateway port can control your agents.
          </span>
        </div>
      )}

      <Select label="Network bind" desc="Which network interfaces the Gateway listens on" value={bind} options={BIND_OPTIONS} onChange={markDirty(setBind)} />
      <Select label="Tailscale" desc="Expose Gateway via Tailscale (requires Tailscale running)" value={tailscaleMode} options={TAILSCALE_MODES} onChange={markDirty(setTailscaleMode)} />
      <Select label="Config reload" desc="How the Gateway handles config file changes" value={reloadMode} options={RELOAD_MODES} onChange={markDirty(setReloadMode)} />

      {/* TLS toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>TLS / HTTPS</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Enable HTTPS with auto-generated or custom certificates</div>
        </div>
        <ToggleSwitch checked={tlsEnabled} onChange={markDirty(setTlsEnabled)} ariaLabel="TLS / HTTPS" />
      </div>

      {/* Ola 7 (oc7-4) — Network discovery (mDNS / DNS-SD) */}
      <NetworkDiscoveryBlock />

      {/* Ola 9 reorg — Devices folded in here (was /settings/devices) */}
      <DevicesBlock />
    </SectionShell>
  );
}

// ── Fused block: Devices (was its own /settings/devices section
// before Ola 9 reorg). Lives here because device pairing writes to
// `gateway.auth.devices.*` — same domain.
function DevicesBlock() {
  const [expanded, setExpanded] = useState(false);
  return (
    <SettingsBlock
      title="Paired devices"
      description="Pairing & rotation"
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div style={{ marginTop: 4 }}>
        <DevicesSection />
      </div>
    </SettingsBlock>
  );
}

// ─── Network Discovery (Ola 7, oc7-4) ───────────────────────────────
// Collapsible block that exposes `discovery.mdns.*` and
// `discovery.wideArea.*`. D12=A — placed inside GatewayAuthSection
// because discovery is conceptually part of "how the Gateway exposes
// itself to the network".

function NetworkDiscoveryBlock() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mdnsMode, setMdnsMode] = useState<'off' | 'minimal' | 'full'>('minimal');
  const [wideAreaEnabled, setWideAreaEnabled] = useState(false);
  const [wideAreaDomain, setWideAreaDomain] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getDiscoveryConfig();
      setMdnsMode((data.mdns?.mode ?? 'minimal') as 'off' | 'minimal' | 'full');
      setWideAreaEnabled(data.wide_area?.enabled ?? false);
      setWideAreaDomain(data.wide_area?.domain ?? '');
      setDirty(false);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !loading && !dirty) fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handleSave = async () => {
    // Pre-flight: if wide-area is enabled, domain must look like a real
    // FQDN. Same regex used by the inline validator above.
    if (wideAreaEnabled && wideAreaDomain.trim()) {
      const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(wideAreaDomain.trim())) {
        toast.error(`Invalid domain format: "${wideAreaDomain}"`);
        return;
      }
    }
    setSaving(true);
    try {
      await gwService.updateDiscoveryConfig({
        mdns: { mode: mdnsMode },
        wide_area: {
          enabled: wideAreaEnabled,
          domain: wideAreaDomain || undefined,
        },
      });
      toast.success('Discovery saved');
      setDirty(false);
    } catch {
      toast.error('Failed to update discovery config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsBlock
      title="Network Discovery (mDNS / DNS-SD)"
      description="Announce on LAN / wide area"
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveLabel="Save discovery"
    >
      <p
        style={{
          margin: '12px 0',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Bonjour/mDNS lets other devices on the same LAN auto-discover this OpenClaw instance without configuring
        IPs. <strong>WSL2 caveat:</strong> mDNS may not propagate to the Windows host due to NAT — useful only for
        bare-metal or Docker host networking.
      </p>

      {/* mdns mode */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>mDNS mode</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            <code>off</code>: silent. <code>minimal</code>: basic service. <code>full</code>: includes metadata
            (version, agents, ACP endpoint).
          </div>
        </div>
        <select
          value={mdnsMode}
          onChange={(e) => {
            setMdnsMode(e.target.value as 'off' | 'minimal' | 'full');
            setDirty(true);
          }}
          style={{
            padding: '4px 8px',
            fontSize: '0.75rem',
            minWidth: 140,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <option value="off">off</option>
          <option value="minimal">minimal</option>
          <option value="full">full</option>
        </select>
      </div>

      {/* wideArea enabled */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wide-area discovery (DNS-SD)</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Announce on a public DNS domain you control. Most users keep this off.
          </div>
        </div>
        <div
          onClick={() => {
            setWideAreaEnabled((v) => !v);
            setDirty(true);
          }}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            cursor: 'pointer',
            background: wideAreaEnabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: 2,
              left: wideAreaEnabled ? 18 : 2,
              transition: 'left 0.2s',
            }}
          />
        </div>
      </div>

      {/* wideArea domain (only when enabled) */}
      {wideAreaEnabled && (() => {
        // Lightweight inline validation. Backend will validate too, but
        // catching obviously-wrong values here saves a round-trip and
        // makes the bad-format feedback immediate instead of post-save.
        // Accepts standard DNS labels: "example.com", "sub.example.io",
        // "my-host.example.local". Rejects spaces, @, /, etc.
        const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
        const isEmpty = !wideAreaDomain.trim();
        const isValid = isEmpty || domainRegex.test(wideAreaDomain.trim());
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Domain</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Domain you own with DNS-SD records configured (e.g. <code>example.com</code>).
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={wideAreaDomain}
                onChange={(e) => {
                  setWideAreaDomain(e.target.value);
                  setDirty(true);
                }}
                placeholder="example.com"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  minWidth: 220,
                  background: 'var(--surface)',
                  border: `1px solid ${isValid ? 'var(--border)' : '#ef4444'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              {!isValid && (
                <span
                  style={{ fontSize: '0.625rem', color: '#ef4444' }}
                  title="Invalid domain format"
                >
                  !
                </span>
              )}
            </div>
          </div>
        );
      })()}
    </SettingsBlock>
  );
}

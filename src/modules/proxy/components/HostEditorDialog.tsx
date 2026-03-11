import { useState } from 'react';
import { X, Plus, Trash2, Globe, Server, Mail, Zap } from 'lucide-react';
import type { ProxyHostInput, ProxyHost } from '../hooks/use-proxy-hosts';

interface HostEditorDialogProps {
  host?: ProxyHost | null;
  onSave: (input: ProxyHostInput) => Promise<unknown>;
  onClose: () => void;
}

// ─── Presets ─────────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  defaults: Partial<ProxyHostInput>;
}

const PRESETS: Preset[] = [
  {
    id: 'website', label: 'Website', icon: Globe, color: '#3b82f6',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 3000, block_exploits: true, compression: true },
  },
  {
    id: 'api', label: 'API / Backend', icon: Server, color: '#22c55e',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 8080, block_exploits: true, rate_limit: '100r/m' },
  },
  {
    id: 'app', label: 'Web App', icon: Zap, color: '#a855f7',
    defaults: { scheme: 'https', forward_host: 'localhost', forward_port: 8443, block_exploits: true, websocket_support: true, compression: true },
  },
  {
    id: 'mail', label: 'Webmail', icon: Mail, color: '#f59e0b',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 8880, block_exploits: true, websocket_support: true },
  },
];

// ─── Component ───────────────────────────────────────────────────────

export function HostEditorDialog({ host, onSave, onClose }: HostEditorDialogProps) {
  const isEdit = !!host;
  const [tab, setTab] = useState<'details' | 'ssl' | 'advanced'>('details');
  const [saving, setSaving] = useState(false);

  // Form state
  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<string[]>(host?.domain_names ?? []);
  const [scheme, setScheme] = useState(host?.scheme ?? 'http');
  const [forwardHost, setForwardHost] = useState(host?.forward_host ?? '');
  const [forwardPort, setForwardPort] = useState(host?.forward_port ?? 80);
  const [label, setLabel] = useState(host?.label ?? '');
  const [notes, setNotes] = useState(host?.notes ?? '');

  // SSL
  const [sslMode, setSslMode] = useState(host?.ssl_mode ?? 'none');
  const [forceSsl, setForceSsl] = useState(host?.force_ssl ?? false);
  const [hstsEnabled, setHstsEnabled] = useState(host?.hsts_enabled ?? false);

  // Advanced
  const [blockExploits, setBlockExploits] = useState(host?.block_exploits ?? true);
  const [websocketSupport, setWebsocketSupport] = useState(host?.websocket_support ?? false);
  const [compression, setCompression] = useState(host?.compression ?? false);
  const [cacheAssets, setCacheAssets] = useState(host?.cache_assets ?? false);
  const [http2Support, setHttp2Support] = useState(host?.http2_support ?? true);
  const [rateLimit, setRateLimit] = useState(host?.rate_limit ?? '');

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (d && !domains.includes(d)) {
      setDomains([...domains, d]);
    }
    setDomainInput('');
  };

  const removeDomain = (d: string) => setDomains(domains.filter(x => x !== d));

  const applyPreset = (preset: Preset) => {
    const d = preset.defaults;
    if (d.scheme) setScheme(d.scheme);
    if (d.forward_host) setForwardHost(d.forward_host);
    if (d.forward_port) setForwardPort(d.forward_port);
    if (d.block_exploits !== undefined) setBlockExploits(d.block_exploits);
    if (d.websocket_support !== undefined) setWebsocketSupport(d.websocket_support);
    if (d.compression !== undefined) setCompression(d.compression);
    if (d.rate_limit !== undefined) setRateLimit(d.rate_limit ?? '');
  };

  const handleSave = async () => {
    if (domains.length === 0 || !forwardHost) return;
    setSaving(true);
    const input: ProxyHostInput = {
      host_type: 'proxy',
      domain_names: domains,
      scheme,
      forward_host: forwardHost,
      forward_port: forwardPort,
      ssl_mode: sslMode,
      force_ssl: forceSsl,
      hsts_enabled: hstsEnabled,
      block_exploits: blockExploits,
      websocket_support: websocketSupport,
      compression,
      cache_assets: cacheAssets,
      http2_support: http2Support,
      rate_limit: rateLimit || null,
      label: label || undefined,
      notes: notes || undefined,
    };
    await onSave(input);
    setSaving(false);
  };

  const canSave = domains.length > 0 && forwardHost.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 640, maxHeight: '85vh',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {isEdit ? 'Edit Proxy Host' : 'New Proxy Host'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: 4,
            cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }}>
          {(['details', 'ssl', 'advanced'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--amber)' : '2px solid transparent',
                color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Presets (only for new) */}
              {!isEdit && (
                <div>
                  <FieldLabel>Quick Preset</FieldLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRESETS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '0.75rem', fontWeight: 600,
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--font-sans)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = p.color + '66'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <p.icon size={12} style={{ color: p.color }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Domain Names */}
              <div>
                <FieldLabel>Domain Names</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="e.g. app.example.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={addDomain} style={smallBtnStyle}>
                    <Plus size={14} />
                  </button>
                </div>
                {domains.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {domains.map(d => (
                      <span key={d} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--text)',
                      }}>
                        {d}
                        <button onClick={() => removeDomain(d)} style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                        }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Forward destination */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', gap: 10 }}>
                <div>
                  <FieldLabel>Scheme</FieldLabel>
                  <select
                    value={scheme}
                    onChange={(e) => setScheme(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="http">http</option>
                    <option value="https">https</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Forward Host</FieldLabel>
                  <input
                    type="text"
                    placeholder="localhost"
                    value={forwardHost}
                    onChange={(e) => setForwardHost(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Port</FieldLabel>
                  <input
                    type="number"
                    value={forwardPort}
                    onChange={(e) => setForwardPort(parseInt(e.target.value) || 80)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Label & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabel>Label (optional)</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. My App"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Notes (optional)</FieldLabel>
                  <input
                    type="text"
                    placeholder="Internal notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'ssl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>SSL Mode</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['none', 'auto', 'custom', 'dns_challenge'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setSslMode(m)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: sslMode === m ? '1px solid var(--amber)' : '1px solid var(--border)',
                        background: sslMode === m ? 'rgba(212, 160, 23, 0.08)' : 'var(--surface)',
                        color: sslMode === m ? 'var(--amber)' : 'var(--text-dim)',
                        fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {m === 'none' ? 'None' : m === 'auto' ? 'Auto (ACME)' : m === 'custom' ? 'Custom' : 'DNS Challenge'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {sslMode === 'auto' && "Caddy will automatically obtain and renew certificates via Let's Encrypt / ZeroSSL."}
                  {sslMode === 'none' && 'No SSL — traffic will be served over HTTP only.'}
                  {sslMode === 'custom' && 'Upload your own certificate and key files.'}
                  {sslMode === 'dns_challenge' && 'Use DNS-01 challenge for wildcard certificates.'}
                </div>
              </div>

              <ToggleField label="Force HTTPS" description="Redirect all HTTP traffic to HTTPS" checked={forceSsl} onChange={setForceSsl} />
              <ToggleField label="HSTS" description="Enable HTTP Strict Transport Security header" checked={hstsEnabled} onChange={setHstsEnabled} />
            </div>
          )}

          {tab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToggleField label="Block Common Exploits" description="Add security headers (X-Frame-Options, X-XSS-Protection, etc.)" checked={blockExploits} onChange={setBlockExploits} />
              <ToggleField label="WebSocket Support" description="Enable WebSocket proxying (flush interval = -1)" checked={websocketSupport} onChange={setWebsocketSupport} />
              <ToggleField label="Compression" description="Enable gzip + zstd compression" checked={compression} onChange={setCompression} />
              <ToggleField label="Cache Assets" description="Cache static assets (images, CSS, JS)" checked={cacheAssets} onChange={setCacheAssets} />
              <ToggleField label="HTTP/2" description="Enable HTTP/2 protocol support" checked={http2Support} onChange={setHttp2Support} />

              <div>
                <FieldLabel>Rate Limit</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. 100r/m (leave empty for no limit)"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 250 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              ...saveBtnStyle,
              opacity: (!canSave || saving) ? 0.5 : 1,
              cursor: (!canSave || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : isEdit ? 'Update Host' : 'Create Host'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: 'var(--text-muted)', marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      cursor: 'pointer', padding: '8px 10px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: checked ? 'rgba(34, 197, 94, 0.04)' : 'var(--surface)',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#22c55e', marginTop: 2 }}
      />
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {description}
        </div>
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)',
  outline: 'none',
};

const smallBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, flexShrink: 0,
  background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};

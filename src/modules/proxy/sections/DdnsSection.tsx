import { useState } from 'react';
import {
  RefreshCw, Plus, Trash2, Power, PowerOff, Clock, Globe, Zap,
  CloudLightning, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import type {
  DdnsStatus, DdnsConfig, DdnsHistoryEntry,
  DdnsProviderType, DdnsProviderStatus, DdnsUpdateResult,
} from '../hooks/use-ddns';

interface DdnsSectionProps {
  status: DdnsStatus | null;
  config: DdnsConfig | null;
  history: DdnsHistoryEntry[];
  loading: boolean;
  updating: boolean;
  hasCfConfig: boolean;
  onUpdateConfig: (partial: Partial<DdnsConfig>) => Promise<void>;
  onAddProvider: (input: Record<string, unknown>) => Promise<boolean>;
  onUpdateProvider: (id: string, input: Record<string, unknown>) => Promise<void>;
  onRemoveProvider: (id: string) => Promise<void>;
  onForceUpdate: () => Promise<void>;
}

const PROVIDER_LABELS: Record<DdnsProviderType, string> = {
  cloudflare: 'Cloudflare',
  duckdns: 'DuckDNS',
  noip: 'No-IP',
  dynu: 'Dynu',
  freedns: 'FreeDNS',
  custom: 'Custom',
};

const PROVIDER_COLORS: Record<DdnsProviderType, string> = {
  cloudflare: '#f48120',
  duckdns: '#5da83c',
  noip: '#2196f3',
  dynu: '#00bcd4',
  freedns: '#9c27b0',
  custom: '#607d8b',
};

const STATUS_COLORS: Record<string, string> = {
  synced: '#22c55e',
  error: '#ef4444',
  pending: '#f59e0b',
  updating: '#3b82f6',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DdnsSection({
  status, config, history, loading, updating, hasCfConfig,
  onUpdateConfig, onAddProvider, onUpdateProvider, onRemoveProvider, onForceUpdate,
}: DdnsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        Loading DDNS status...
      </div>
    );
  }

  const enabled = status?.enabled ?? config?.enabled ?? false;

  return (
    <div style={{ padding: 24, maxWidth: 700, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
            Dynamic DNS
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Automatically update DNS records when your public IP changes
          </p>
        </div>
        <button
          onClick={() => onUpdateConfig({ enabled: !enabled })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--border)',
            background: enabled ? 'rgba(34,197,94,0.1)' : 'var(--surface)',
            color: enabled ? '#22c55e' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {enabled ? <Power size={14} /> : <PowerOff size={14} />}
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Status Card */}
      {status && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Metric label="Current IP" value={status.current_ip ?? 'Unknown'} icon={<Globe size={14} />} />
            <Metric label="Last Check" value={timeAgo(status.last_check)} icon={<Clock size={14} />} />
            <Metric label="Last Change" value={timeAgo(status.last_change)} icon={<Zap size={14} />} />
            <Metric label="Interval" value={`${status.interval_minutes} min`} icon={<RefreshCw size={14} />} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onForceUpdate}
              disabled={updating || !enabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                cursor: updating || !enabled ? 'not-allowed' : 'pointer',
                opacity: updating || !enabled ? 0.5 : 1,
                fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              }}
            >
              <RefreshCw size={12} style={updating ? { animation: 'spin 1s linear infinite' } : undefined} />
              {updating ? 'Updating...' : 'Force Update'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Setup Banner */}
      {hasCfConfig && status && status.providers.length === 0 && (
        <div style={{
          background: 'rgba(244,129,32,0.08)', border: '1px solid rgba(244,129,32,0.25)',
          borderRadius: 8, padding: 14, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <CloudLightning size={20} style={{ color: '#f48120', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
              Cloudflare detected
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Set up DDNS using your existing Cloudflare credentials
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '5px 12px', borderRadius: 6,
              background: '#f48120', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Quick Setup
          </button>
        </div>
      )}

      {/* Providers List */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Providers
          </h3>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              cursor: 'pointer', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {status?.providers.length === 0 && (
          <div style={{
            padding: 24, textAlign: 'center',
            color: 'var(--text-muted)', fontSize: '0.8125rem',
            border: '1px dashed var(--border)', borderRadius: 8,
          }}>
            No providers configured. Add one to start updating DNS records automatically.
          </div>
        )}

        {status?.providers.map((p) => (
          <ProviderRow
            key={p.id}
            provider={p}
            onToggle={() => onUpdateProvider(p.id, { enabled: !p.enabled })}
            onRemove={() => onRemoveProvider(p.id)}
          />
        ))}
      </div>

      {/* Settings */}
      {config && (
        <SettingsPanel
          intervalMinutes={config.interval_minutes}
          detectionMethod={config.detection_method}
          customDetectionUrl={config.custom_detection_url}
          interfaceName={config.interface_name}
          onUpdate={onUpdateConfig}
        />
      )}

      {/* History */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '8px 0', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--text)', fontFamily: 'var(--font-sans)',
          }}
        >
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Recent IP Changes ({history.length})
        </button>
        {showHistory && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 8,
            overflow: 'hidden',
          }}>
            {history.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No IP changes recorded yet
              </div>
            ) : (
              history.slice(0, 20).map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', fontSize: '0.75rem',
                  borderBottom: i < Math.min(history.length, 20) - 1 ? '1px solid var(--border)' : 'none',
                  color: 'var(--text-dim)',
                }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>
                    {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    {entry.old_ip ?? '—'} → {entry.new_ip}
                  </span>
                  {entry.providers_failed.length > 0 && (
                    <span style={{ color: '#ef4444', fontSize: '0.6875rem' }}>
                      {entry.providers_failed.length} failed
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Provider Dialog */}
      {showAddForm && (
        <AddProviderDialog
          hasCfConfig={hasCfConfig}
          onAdd={async (input) => {
            const ok = await onAddProvider(input);
            if (ok) setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

function ProviderRow({ provider, onToggle, onRemove }: {
  provider: DdnsProviderStatus;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', marginBottom: 4,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: STATUS_COLORS[provider.status] ?? '#6b7280',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: '0.6875rem', fontWeight: 700,
        color: PROVIDER_COLORS[provider.type] ?? '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.02em',
        minWidth: 70,
      }}>
        {PROVIDER_LABELS[provider.type]}
      </span>
      <span style={{
        flex: 1, fontSize: '0.8125rem', color: 'var(--text)',
        fontFamily: 'var(--font-mono, monospace)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {provider.hostname}
      </span>
      {provider.last_error && (
        <span style={{ fontSize: '0.6875rem', color: '#ef4444', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {provider.last_error}
        </span>
      )}
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        {timeAgo(provider.last_update)}
      </span>
      <button
        onClick={onToggle}
        title={provider.enabled ? 'Disable' : 'Enable'}
        style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 4,
          color: provider.enabled ? '#22c55e' : '#6b7280',
        }}
      >
        {provider.enabled ? <Power size={14} /> : <PowerOff size={14} />}
      </button>
      <button
        onClick={onRemove}
        title="Remove"
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#ef4444' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function SettingsPanel({ intervalMinutes, detectionMethod, customDetectionUrl, interfaceName, onUpdate }: {
  intervalMinutes: number;
  detectionMethod: string;
  customDetectionUrl: string | null;
  interfaceName: string | null;
  onUpdate: (partial: Partial<DdnsConfig>) => Promise<void>;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 14,
    }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
        Settings
      </h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Check interval
          <select
            value={intervalMinutes}
            onChange={(e) => onUpdate({ interval_minutes: parseInt(e.target.value) })}
            style={{
              marginLeft: 6, padding: '3px 6px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {[1, 2, 5, 10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Detection
          <select
            value={detectionMethod}
            onChange={(e) => onUpdate({ detection_method: e.target.value as 'auto' | 'interface' | 'custom_url' })}
            style={{
              marginLeft: 6, padding: '3px 6px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="auto">Auto (multiple services)</option>
            <option value="interface">Network interface</option>
            <option value="custom_url">Custom URL</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function AddProviderDialog({ hasCfConfig, onAdd, onClose }: {
  hasCfConfig: boolean;
  onAdd: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<DdnsProviderType>(hasCfConfig ? 'cloudflare' : 'duckdns');
  const [hostname, setHostname] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [updateKey, setUpdateKey] = useState('');
  const [updateUrl, setUpdateUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [successPattern, setSuccessPattern] = useState('');
  const [proxied, setProxied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!hostname.trim()) return;
    setSubmitting(true);

    const input: Record<string, unknown> = { type, hostname: hostname.trim() };

    switch (type) {
      case 'cloudflare':
        input.use_proxy_credentials = hasCfConfig;
        input.proxied = proxied;
        input.record_type = 'A';
        break;
      case 'duckdns':
        if (!token.trim()) { setSubmitting(false); return; }
        input.token = token.trim();
        break;
      case 'noip':
      case 'dynu':
        if (!username.trim() || !password.trim()) { setSubmitting(false); return; }
        input.username = username.trim();
        input.password = password.trim();
        break;
      case 'freedns':
        if (!updateKey.trim()) { setSubmitting(false); return; }
        input.update_key = updateKey.trim();
        break;
      case 'custom':
        if (!updateUrl.trim()) { setSubmitting(false); return; }
        input.name = customName.trim() || 'Custom';
        input.update_url = updateUrl.trim();
        input.method = method;
        if (successPattern.trim()) input.success_pattern = successPattern.trim();
        break;
    }

    await onAdd(input);
    setSubmitting(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', color: 'var(--text-muted)',
    display: 'block', marginBottom: 4, marginTop: 10,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 420, maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Add DDNS Provider
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Provider type selector */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {(['cloudflare', 'duckdns', 'noip', 'dynu', 'freedns', 'custom'] as DdnsProviderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: type === t ? `1px solid ${PROVIDER_COLORS[t]}` : '1px solid var(--border)',
                background: type === t ? `${PROVIDER_COLORS[t]}22` : 'var(--bg)',
                color: type === t ? PROVIDER_COLORS[t] : 'var(--text-dim)',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {PROVIDER_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Hostname (always required) */}
        <label style={labelStyle}>Hostname</label>
        <input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder={type === 'duckdns' ? 'myhost (without .duckdns.org)' : 'home.example.com'}
          style={inputStyle}
        />

        {/* Type-specific fields */}
        {type === 'cloudflare' && hasCfConfig && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: 'rgba(244,129,32,0.06)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Using Cloudflare credentials from Proxy module
          </div>
        )}

        {type === 'cloudflare' && (
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={proxied} onChange={(e) => setProxied(e.target.checked)} />
            Proxied through Cloudflare (hides real IP)
          </label>
        )}

        {type === 'duckdns' && (
          <>
            <label style={labelStyle}>Token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Your DuckDNS token" style={inputStyle} />
          </>
        )}

        {(type === 'noip' || type === 'dynu') && (
          <>
            <label style={labelStyle}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Email or username" style={inputStyle} />
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password or API key" style={inputStyle} />
          </>
        )}

        {type === 'freedns' && (
          <>
            <label style={labelStyle}>Update Key</label>
            <input value={updateKey} onChange={(e) => setUpdateKey(e.target.value)} placeholder="Unique update key from FreeDNS" style={inputStyle} />
          </>
        )}

        {type === 'custom' && (
          <>
            <label style={labelStyle}>Provider Name</label>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="My Provider" style={inputStyle} />
            <label style={labelStyle}>Update URL (use &#123;ip&#125; and &#123;hostname&#125; as variables)</label>
            <input value={updateUrl} onChange={(e) => setUpdateUrl(e.target.value)} placeholder="https://api.example.com/update?ip={ip}&host={hostname}" style={inputStyle} />
            <label style={labelStyle}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')} style={inputStyle}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
            <label style={labelStyle}>Success Pattern (regex, optional)</label>
            <input value={successPattern} onChange={(e) => setSuccessPattern(e.target.value)} placeholder="^(ok|good|success)" style={inputStyle} />
          </>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !hostname.trim()}
          style={{
            width: '100%', marginTop: 16, padding: '8px 16px',
            borderRadius: 8, border: 'none',
            background: 'var(--amber)', color: '#000',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            fontSize: '0.875rem', fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {submitting ? 'Adding...' : 'Add Provider'}
        </button>
      </div>
    </div>
  );
}

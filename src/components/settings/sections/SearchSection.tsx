import { useEffect, useState } from 'react';
import {
  Search, Globe, Shield, Plus, X, Wifi, WifiOff, Lock,
  Eye, EyeOff, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useApiKeyStore } from '@/stores/apikey.store';
import { useSettingsStore } from '@/stores/settings.store';

// ─── Types ───────────────────────────────────────────────

interface BrowserSecurityConfig {
  internet_access: boolean;
  local_network_access: boolean;
  local_network_allowlist: string[];
  domain_denylist: string[];
  allow_web_auth: boolean;
  isolated_sessions: boolean;
  persist_sessions: boolean;
}

// ─── Shared components ───────────────────────────────────

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--amber)' : 'var(--surface)',
        border: `1px solid ${checked ? 'var(--amber)' : 'var(--border)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#06060a' : 'var(--text-dim)',
        position: 'absolute', top: 2,
        left: checked ? 20 : 2,
        transition: 'left 0.15s ease',
      }} />
    </button>
  );
}

function ListEditor({
  items, onAdd, onRemove, placeholder, validate,
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  validate?: (item: string) => boolean;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (validate && !validate(trimmed)) {
      toast.error('Invalid format');
      return;
    }
    if (items.includes(trimmed)) {
      toast.error('Already in the list');
      return;
    }
    onAdd(trimmed);
    setInput('');
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 8,
      marginTop: 6,
    }}>
      {items.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px', fontFamily: 'var(--font-sans)' }}>
          (none)
        </div>
      )}
      {items.map((item, i) => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px',
          fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', color: 'var(--text)',
        }}>
          <span>{item}</span>
          <button
            onClick={() => onRemove(i)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '4px 8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Web Search Config ───────────────────────────────────

function WebSearchConfig() {
  const providers = useApiKeyStore((s) => s.providers);
  const testing = useApiKeyStore((s) => s.testing);
  const configureKey = useApiKeyStore((s) => s.configureKey);
  const deleteKey = useApiKeyStore((s) => s.deleteKey);
  const testConnection = useApiKeyStore((s) => s.testConnection);
  const settings = useSettingsStore((s) => s.settings);
  const tier = (settings as any)?.tier ?? 'free';

  const [tavilyKey, setTavilyKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const tavilyProvider = providers?.tavily;

  const handleSaveTavily = async () => {
    if (!tavilyKey) return;
    try {
      await configureKey('tavily', tavilyKey);
      setTavilyKey('');
      toast.success('Tavily API key saved');
    } catch {
      toast.error('Failed to save key');
    }
  };

  const handleTestTavily = async () => {
    const result = await testConnection('tavily');
    toast[result.valid ? 'success' : 'error'](result.valid ? 'Tavily connected!' : 'Connection failed');
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 12,
      }}>
        <Globe size={16} style={{ color: 'var(--amber)' }} />
        Web Search Engine
      </div>

      {/* Tavily */}
      <SettingRow
        label="Tavily API Key"
        description="Free search engine — get your key at tavily.com"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {tavilyProvider?.configured ? (
            <>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                ••••{tavilyProvider.last_4}
              </span>
              {tavilyProvider.valid === true && <CheckCircle size={14} style={{ color: '#22c55e' }} />}
              {tavilyProvider.valid === false && <XCircle size={14} style={{ color: '#ef4444' }} />}
              <button
                onClick={handleTestTavily}
                disabled={testing === 'tavily'}
                style={{
                  padding: '3px 8px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-dim)', fontSize: '0.6875rem',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                {testing === 'tavily' ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : 'Test'}
              </button>
              <button
                onClick={() => deleteKey('tavily')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  placeholder="tvly-..."
                  style={{
                    width: 180, padding: '4px 28px 4px 8px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    fontSize: '0.75rem', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                  }}
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <button
                onClick={handleSaveTavily}
                disabled={!tavilyKey}
                style={{
                  padding: '4px 10px', background: tavilyKey ? 'var(--amber)' : 'var(--surface)',
                  color: tavilyKey ? '#06060a' : 'var(--text-muted)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: tavilyKey ? 'pointer' : 'default',
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </SettingRow>

      {/* Brave (Pro) */}
      <SettingRow
        label="Brave Search"
        description={tier === 'pro' ? 'Pre-configured with Claw Credits' : 'Available with Pro subscription'}
      >
        {tier === 'pro' ? (
          <span style={{ fontSize: '0.75rem', color: '#22c55e', fontFamily: 'var(--font-sans)' }}>
            <CheckCircle size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Configured
          </span>
        ) : (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.6875rem', padding: '2px 8px',
            background: 'rgba(212,160,23,0.15)', color: 'var(--amber)',
            borderRadius: 'var(--radius-sm)', fontWeight: 600,
          }}>
            <Lock size={10} />
            PRO
          </span>
        )}
      </SettingRow>
    </div>
  );
}

// ─── Browser Security Config ─────────────────────────────

function BrowserSecurityConfig() {
  const [config, setConfig] = useState<BrowserSecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await api.get<{ data: BrowserSecurityConfig }>('/settings/browser-security');
      setConfig(res.data);
    } catch { /* use defaults */ }
    setLoading(false);
  };

  const patchConfig = async (update: Partial<BrowserSecurityConfig>) => {
    try {
      const res = await api.patch<{ data: BrowserSecurityConfig }>('/settings/browser-security', update);
      setConfig(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  if (loading || !config) {
    return (
      <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
        Loading security settings...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 12, marginTop: 24,
      }}>
        <Shield size={16} style={{ color: 'var(--amber)' }} />
        Browser Security
      </div>

      <SettingRow
        label="Internet Access"
        description="The agent can browse public websites"
      >
        <Toggle checked={config.internet_access} onChange={(v) => patchConfig({ internet_access: v })} />
      </SettingRow>

      <SettingRow
        label="Local Network Access"
        description="Allow access to local devices (router, NAS, HA)"
      >
        <Toggle checked={config.local_network_access} onChange={(v) => patchConfig({ local_network_access: v })} />
      </SettingRow>

      {config.local_network_access && (
        <div style={{ padding: '0 0 8px 0' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
            Allowed local addresses
          </div>
          <ListEditor
            items={config.local_network_allowlist}
            onAdd={(item) => patchConfig({ local_network_allowlist: [...config.local_network_allowlist, item] })}
            onRemove={(i) => patchConfig({ local_network_allowlist: config.local_network_allowlist.filter((_, idx) => idx !== i) })}
            placeholder="192.168.1.1 or homeassistant.local"
          />
        </div>
      )}

      <div style={{ padding: '0 0 8px 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4, marginTop: 8 }}>
          Blocked Domains
        </div>
        <ListEditor
          items={config.domain_denylist}
          onAdd={(item) => patchConfig({ domain_denylist: [...config.domain_denylist, item] })}
          onRemove={(i) => patchConfig({ domain_denylist: config.domain_denylist.filter((_, idx) => idx !== i) })}
          placeholder="example.com"
          validate={(item) => /^[\w.-]+\.[a-z]{2,}$/.test(item.replace(/^https?:\/\//, '').split('/')[0])}
        />
      </div>

      <SettingRow
        label="Web Authentication"
        description="Allow the agent to log into websites"
      >
        <Toggle checked={config.allow_web_auth} onChange={(v) => patchConfig({ allow_web_auth: v })} />
      </SettingRow>

      {config.allow_web_auth && (
        <div style={{
          padding: '4px 0 4px 16px',
          fontSize: '0.75rem', color: '#f59e0b',
          fontFamily: 'var(--font-sans)',
          borderLeft: '2px solid #f59e0b',
          marginBottom: 4,
        }}>
          The agent will have access to your accounts on allowed websites.
        </div>
      )}

      <SettingRow
        label="Isolated Sessions"
        description="Each browsing session starts clean (no cookies)"
      >
        <Toggle checked={config.isolated_sessions} onChange={(v) => patchConfig({ isolated_sessions: v })} />
      </SettingRow>

      <SettingRow
        label="Persistent Sessions"
        description={config.allow_web_auth ? 'Keep cookies and sessions between uses' : 'Requires Web Authentication to be enabled'}
      >
        <Toggle
          checked={config.persist_sessions}
          onChange={(v) => patchConfig({ persist_sessions: v })}
          disabled={!config.allow_web_auth}
        />
      </SettingRow>
    </div>
  );
}

// ─── Main Section ────────────────────────────────────────

export function SearchSection() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 20,
      }}>
        <Search size={20} style={{ color: 'var(--amber)' }} />
        Search & Web
      </div>

      <WebSearchConfig />
      <BrowserSecurityConfig />
    </div>
  );
}

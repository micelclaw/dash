/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Built-in provider keys (Anthropic, OpenAI, Google, DeepSeek).
 * Moved out of Settings → AI Intelligence so the Gateway → Models → Advanced
 * tab is the single place for everything credentials/providers related.
 *
 * Uses the existing useApiKeyStore + /settings/ai/api-keys/* endpoints —
 * the storage location did not change, only the UI surface.
 */

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { useApiKeyStore } from '@/stores/apikey.store';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'google', label: 'Google', placeholder: 'AIza...' },
  { id: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
];

function StatusIcon({ valid }: { valid?: boolean }) {
  if (valid === true) return <CheckCircle size={14} style={{ color: '#22c55e' }} />;
  if (valid === false) return <XCircle size={14} style={{ color: '#ef4444' }} />;
  return <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />;
}

export function BuiltinProviderKeysBlock() {
  const settings = useSettingsStore((s) => s.settings);
  const providers = useApiKeyStore((s) => s.providers);
  const testing = useApiKeyStore((s) => s.testing);
  const loadFromSettings = useApiKeyStore((s) => s.loadFromSettings);
  const configureKey = useApiKeyStore((s) => s.configureKey);
  const deleteKey = useApiKeyStore((s) => s.deleteKey);
  const testConnection = useApiKeyStore((s) => s.testConnection);

  const [configuring, setConfiguring] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settings?.ai?.api_keys) loadFromSettings(settings.ai.api_keys);
  }, [settings?.ai?.api_keys, loadFromSettings]);

  const handleConfigure = async (provider: string) => {
    if (!keyInput.trim()) return;
    try {
      await configureKey(provider, keyInput.trim());
      toast.success(`${provider} key configured`);
      setConfiguring(null);
      setKeyInput('');
      setShowKey(false);
    } catch {
      toast.error('Failed to configure key');
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      await deleteKey(provider);
      toast.success(`${provider} key removed`);
    } catch {
      toast.error('Failed to remove key');
    }
  };

  const handleTest = async (provider: string) => {
    const result = await testConnection(provider);
    if (result.valid) toast.success(`${provider} connection verified`);
    else toast.error(`${provider} connection failed`);
  };

  return (
    <div>
      <h3 style={{
        margin: '0 0 4px',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: 'var(--font-display)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>Built-in provider keys</h3>
      <p style={{
        margin: '0 0 12px',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        lineHeight: 1.4,
      }}>
        API keys for the cloud providers shipped with Micelclaw. Stored encrypted; never sent back to the dash in full.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {PROVIDERS.map((p) => {
          const info = providers[p.id];
          const isConfigured = info?.configured;
          const isConfiguring = configuring === p.id;
          const isTesting = testing === p.id;

          return (
            <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)', width: 80 }}>
                  {p.label}
                </span>
                {isConfigured && !isConfiguring ? (
                  <>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                      ····{info.last_4}
                    </span>
                    <StatusIcon valid={info.valid} />
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleTest(p.id)}
                        disabled={isTesting}
                        style={{
                          height: 26, padding: '0 10px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                          fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        }}
                      >
                        {isTesting ? <Loader2 size={12} className="spin" /> : 'Test'}
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{
                          height: 26, padding: '0 8px',
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--error, #ef4444)',
                          fontSize: '0.75rem', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                ) : isConfiguring ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder={p.placeholder}
                        autoFocus
                        style={{
                          width: '100%', height: 30, padding: '0 30px 0 8px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                          fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfigure(p.id);
                          if (e.key === 'Escape') { setConfiguring(null); setKeyInput(''); }
                        }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 2,
                        }}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleConfigure(p.id)}
                      style={{
                        height: 30, padding: '0 12px', background: 'var(--amber)', color: '#06060a',
                        border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                        fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setConfiguring(null); setKeyInput(''); setShowKey(false); }}
                      style={{
                        height: 30, padding: '0 10px', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-dim)', fontSize: '0.8125rem',
                        fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                      Not configured
                    </span>
                    <button
                      onClick={() => { setConfiguring(p.id); setKeyInput(''); setShowKey(false); }}
                      style={{
                        marginLeft: 'auto', height: 26, padding: '0 12px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--amber)',
                        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                      }}
                    >
                      Configure
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

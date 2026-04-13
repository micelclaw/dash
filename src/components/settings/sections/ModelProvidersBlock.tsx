/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const API_TYPES = [
  { value: 'openai-completions', label: 'OpenAI Completions (most compatible)' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
  { value: 'bedrock-converse-stream', label: 'AWS Bedrock' },
];

const MERGE_MODES = [
  { value: 'merge', label: 'Merge — add to built-in providers (recommended)' },
  { value: 'replace', label: 'Replace — only custom providers available (advanced)' },
];

interface ProviderEntry {
  id: string;
  baseUrl: string;
  apiType: string;
  hasApiKey: boolean;
  modelCount: number;
}

export function ModelProvidersBlock() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [mode, setMode] = useState('merge');
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiType, setNewApiType] = useState('openai-completions');
  const [newApiKey, setNewApiKey] = useState('');

  // Auth cooldowns
  const [billingBackoff, setBillingBackoff] = useState(5);
  const [billingMax, setBillingMax] = useState(24);
  const [failureWindow, setFailureWindow] = useState(24);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getProvidersConfig();
      setMode(data.mode ?? 'merge');

      const entries: ProviderEntry[] = [];
      for (const [id, p] of Object.entries(data.providers ?? {})) {
        entries.push({
          id,
          baseUrl: (p.base_url ?? '') as string,
          apiType: (p.api ?? 'openai-completions') as string,
          hasApiKey: p.api_key === '••••••••' || p.apiKey === '••••••••' || !!p.api_key || !!p.apiKey,
          modelCount: Array.isArray(p.models) ? (p.models as unknown[]).length : 0,
        });
      }
      setProviders(entries);

      const cooldowns = (data.auth?.cooldowns ?? {}) as Record<string, unknown>;
      setBillingBackoff((cooldowns.billing_backoff_hours ?? 5) as number);
      setBillingMax((cooldowns.billing_max_hours ?? 24) as number);
      setFailureWindow((cooldowns.failure_window_hours ?? 24) as number);

      setDirty(false);
    } catch { toast.error('Failed to load providers config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleAddProvider = async () => {
    if (!newId.trim() || !newBaseUrl.trim()) {
      toast.error('Provider ID and Base URL are required');
      return;
    }
    setSaving(true);
    try {
      const providerConfig: Record<string, unknown> = {
        baseUrl: newBaseUrl,
        api: newApiType,
        models: [],
      };
      if (newApiKey) providerConfig.apiKey = newApiKey;

      await gwService.updateProvidersConfig({
        models: { providers: { [newId]: providerConfig } },
      });
      toast.success(`Provider "${newId}" added`);
      setShowAdd(false);
      setNewId('');
      setNewBaseUrl('');
      setNewApiKey('');
      fetchConfig();
    } catch { toast.error('Failed to add provider'); }
    finally { setSaving(false); }
  };

  const handleRemoveProvider = async (id: string) => {
    if (!confirm(`Remove provider "${id}"? Models from this provider will no longer be available.`)) return;
    setSaving(true);
    try {
      await gwService.updateProvidersConfig({
        models: { providers: { [id]: null } }, // null deletes in merge patch
      });
      toast.success(`Provider "${id}" removed`);
      fetchConfig();
    } catch { toast.error('Failed to remove provider'); }
    finally { setSaving(false); }
  };

  const handleSaveCooldowns = async () => {
    setSaving(true);
    try {
      await gwService.updateProvidersConfig({
        auth: {
          cooldowns: {
            billingBackoffHours: billingBackoff,
            billingMaxHours: billingMax,
            failureWindowHours: failureWindow,
          },
        },
      });
      toast.success('Cooldown config updated');
      setDirty(false);
    } catch { toast.error('Failed to update cooldowns'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '12px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading providers...</div>;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '12px 0', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
          cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Model Providers
        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {providers.length} custom provider{providers.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div style={{ paddingTop: 12 }}>
          {/* Info box */}
          <div style={{
            display: 'flex', gap: 10, padding: '10px 14px', marginBottom: 16,
            background: '#06b6d410', border: '1px solid #06b6d425', borderRadius: 'var(--radius-md)',
          }}>
            <Info size={14} style={{ color: '#06b6d4', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Built-in providers (Anthropic, OpenAI, Google) are configured via API Keys above.
              Custom providers let you add local models (vLLM, SGLang) or third-party services (OpenRouter, Together AI).
              Auth profile rotation happens automatically when a provider is rate-limited — the system tries the next available profile.
            </div>
          </div>

          {/* Merge mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Provider mode</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Merge adds custom providers alongside built-in ones. Replace disables built-ins.
              </div>
            </div>
            <select value={mode} onChange={e => { setMode(e.target.value); setDirty(true); }} style={{
              padding: '4px 8px', fontSize: '0.75rem', minWidth: 220,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              {MERGE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Custom providers list */}
          {providers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {providers.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{p.id}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
                      {p.baseUrl || 'No URL'}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.apiType} · {p.modelCount} model{p.modelCount !== 1 ? 's' : ''} · {p.hasApiKey ? 'Key configured' : 'No key'}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveProvider(p.id)} title="Remove provider" style={{
                    background: 'none', border: '1px solid transparent', padding: 4,
                    cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add provider form */}
          {showAdd ? (
            <div style={{
              padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Provider ID</label>
                  <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g. vllm, openrouter" style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base URL</label>
                  <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8000/v1" style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Type</label>
                  <select value={newApiType} onChange={e => setNewApiType(e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                    {API_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Key (optional)</label>
                  <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="sk-..." style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={handleAddProvider} disabled={saving} style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#000', fontFamily: 'var(--font-sans)', opacity: saving ? 0.7 : 1 }}>Add Provider</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', marginBottom: 12,
              fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
            }}>
              <Plus size={12} /> Add Custom Provider
            </button>
          )}

          {/* Cooldowns */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Auth Cooldowns
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              When a provider is rate-limited or has billing issues, OpenClaw backs off exponentially.
            </div>
            {[
              { label: 'Billing backoff start (hours)', desc: 'Initial cooldown for billing errors (doubles each failure)', value: billingBackoff, set: setBillingBackoff, min: 1, max: 48 },
              { label: 'Billing max cooldown (hours)', desc: 'Maximum backoff for billing errors', value: billingMax, set: setBillingMax, min: 1, max: 72 },
              { label: 'Failure window (hours)', desc: 'Reset cooldown counter after this many hours without failure', value: failureWindow, set: setFailureWindow, min: 1, max: 72 },
            ].map(field => (
              <div key={field.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{field.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>{field.desc}</div>
                </div>
                <input type="number" value={field.value} min={field.min} max={field.max} onChange={e => { field.set(parseInt(e.target.value, 10) || field.min); setDirty(true); }} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
              </div>
            ))}
            {dirty && (
              <button onClick={handleSaveCooldowns} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', marginTop: 8,
                fontSize: '0.75rem', fontWeight: 600, background: 'var(--amber)', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#000', fontFamily: 'var(--font-sans)', opacity: saving ? 0.7 : 1,
              }}>
                <Save size={12} /> Save Cooldowns
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

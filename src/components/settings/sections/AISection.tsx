import { useState, useEffect, lazy, Suspense } from 'react';
import { Eye, EyeOff, Trash2, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LazyTokenDashboard = lazy(() => import('./TokenUsageDashboard').then(m => ({ default: m.TokenUsageDashboard })));
import { useSettingsStore } from '@/stores/settings.store';
import { useApiKeyStore } from '@/stores/apikey.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SaveBar } from '../SaveBar';
import { GraphHealthSection } from './GraphHealthSection';
import { EntityExtractionConfig } from './EntityExtractionConfig';

const CLOUD_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-3-5',
  'deepseek-chat',
  'gpt-4o',
  'gemini-2.0-flash',
];

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

function OllamaStatusBadge({ status }: { status: string }) {
  const color = status === 'connected' ? '#22c55e' : status === 'error' ? '#f59e0b' : '#ef4444';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.75rem', color, fontFamily: 'var(--font-sans)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

export function AISection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

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
    if (settings?.ai?.api_keys) {
      loadFromSettings(settings.ai.api_keys);
    }
  }, [settings?.ai?.api_keys, loadFromSettings]);

  if (!settings) return null;
  const ai = settings.ai;

  const allModels = [
    ...CLOUD_MODELS.map((m) => ({ value: m, label: m })),
    ...ai.local_models.available_models.map((m) => ({ value: m, label: `${m} (local)` })),
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('ai', {
        default_model: ai.default_model,
        payment_method: ai.payment_method,
        auto_routing: ai.auto_routing,
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const handleConfigureKey = async (provider: string) => {
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

  const handleDeleteKey = async (provider: string) => {
    try {
      await deleteKey(provider);
      toast.success(`${provider} key removed`);
    } catch {
      toast.error('Failed to remove key');
    }
  };

  const handleTestKey = async (provider: string) => {
    const result = await testConnection(provider);
    if (result.valid) {
      toast.success(`${provider} connection verified`);
    } else {
      toast.error(`${provider} connection failed`);
    }
  };

  return (
    <>
      {/* Model Configuration */}
      <SettingSection title="Model Configuration">
        <SettingSelect
          label="Default Model"
          value={ai.default_model}
          options={allModels}
          onChange={(v) => setLocalValue('ai.default_model', v)}
        />

        {/* Payment Method */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Payment Method</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['byok', 'credits'] as const).map((method) => {
              const isActive = ai.payment_method === method;
              const labels: Record<string, string> = { byok: 'Bring Your Own Key (BYOK)', credits: 'Claw Credits (Pro)' };
              return (
                <button
                  key={method}
                  onClick={() => setLocalValue('ai.payment_method', method)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 30, padding: '0 12px',
                    background: isActive ? 'var(--amber)' : 'var(--surface)',
                    color: isActive ? '#06060a' : 'var(--text-dim)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${isActive ? '#06060a' : 'var(--text-muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06060a' }} />}
                  </span>
                  {labels[method]}
                </button>
              );
            })}
          </div>
        </div>

        <SettingToggle
          label="Auto-routing"
          description="When enabled, the system automatically selects the best model for each task."
          checked={ai.auto_routing}
          onChange={(v) => setLocalValue('ai.auto_routing', v)}
        />
      </SettingSection>

      {/* API Keys */}
      <SettingSection title="API Keys">
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
                        onClick={() => handleTestKey(p.id)}
                        disabled={isTesting}
                        style={{
                          height: 26, padding: '0 10px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                          fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                        }}
                      >
                        {isTesting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Test'}
                      </button>
                      <button
                        onClick={() => handleDeleteKey(p.id)}
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
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfigureKey(p.id); if (e.key === 'Escape') { setConfiguring(null); setKeyInput(''); } }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleConfigureKey(p.id)}
                      style={{ height: 30, padding: '0 12px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setConfiguring(null); setKeyInput(''); setShowKey(false); }}
                      style={{ height: 30, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>Not configured</span>
                    <button
                      onClick={() => { setConfiguring(p.id); setKeyInput(''); setShowKey(false); }}
                      style={{ marginLeft: 'auto', height: 26, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--amber)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                    >
                      Configure
                    </button>
                  </>
                )}
              </div>
              {isConfiguring && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, paddingLeft: 88, fontFamily: 'var(--font-sans)' }}>
                  The key is stored encrypted. We never see your full key.
                </div>
              )}
            </div>
          );
        })}
      </SettingSection>

      {/* Local Models (Ollama) */}
      <SettingSection title="Local Models (Ollama)">
        <SettingInput
          label="Ollama URL"
          value={ai.local_models.ollama_url}
          onChange={(v) => setLocalValue('ai.local_models.ollama_url', v)}
          type="url"
          placeholder="http://127.0.0.1:11434"
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Status</span>
          <OllamaStatusBadge status={ai.local_models.ollama_status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Available Models</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {ai.local_models.available_models.length > 0
              ? ai.local_models.available_models.map((m) => (
                  <span key={m} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {m}
                  </span>
                ))
              : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None detected</span>
            }
          </div>
        </div>
        {ai.local_models.available_models.length > 0 && (
          <>
            <SettingSelect
              label="Embedding Model"
              value={ai.local_models.embedding_model}
              options={ai.local_models.available_models.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setLocalValue('ai.local_models.embedding_model', v)}
            />
            <SettingSelect
              label="Extraction Model"
              value={ai.local_models.extraction_model}
              options={ai.local_models.available_models.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setLocalValue('ai.local_models.extraction_model', v)}
            />
          </>
        )}
        <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}>
          Tip: Ollama provides free local AI processing. Run <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 2, fontSize: '0.6875rem' }}>ollama pull &lt;model&gt;</code> to add more models.
        </div>
      </SettingSection>

      {/* Token Usage Dashboard */}
      <SettingSection title="Token Usage">
        <Suspense fallback={
          <div style={{ padding: '24px 0' }}>
            <div style={{ height: 60, background: 'var(--surface)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        }>
          <LazyTokenDashboard />
        </Suspense>
      </SettingSection>

      {/* Entity Extraction */}
      <SettingSection title="Entity Extraction">
        <EntityExtractionConfig />
      </SettingSection>

      {/* Graph Health */}
      <SettingSection title="Graph Health">
        <GraphHealthSection />
      </SettingSection>

      <SaveBar visible={!!dirty.ai} saving={saving} onSave={handleSave} onDiscard={() => resetSection('ai')} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

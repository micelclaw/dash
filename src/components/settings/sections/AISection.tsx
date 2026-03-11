import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Eye, EyeOff, Trash2, CheckCircle, XCircle, AlertCircle, Loader2, RotateCw } from 'lucide-react';
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
import { MultimodalModelSection } from './MultimodalModelSection';

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

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface ReindexLog {
  time: string;
  text: string;
  type: 'info' | 'error' | 'success';
}

function EmbeddingReindex() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<ReindexLog[]>([]);
  const [progress, setProgress] = useState<{ processed: number; failed: number; total: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const addLog = useCallback((text: string, type: ReindexLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs(prev => [...prev, { time, text, type }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startReindex = () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    setProgress(null);

    const stored = JSON.parse(localStorage.getItem('claw-auth') || '{}');
    const token = stored?.state?.tokens?.accessToken || '';
    const es = new EventSource(
      `${API_BASE}/api/v1/admin/reindex/stream?force=true&token=${encodeURIComponent(token)}`
    );
    esRef.current = es;

    addLog('Starting full reindex...', 'info');

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case 'start':
            addLog(`Found ${data.total} records across ${Object.keys(data.domains).length} domains`, 'info');
            setProgress({ processed: 0, failed: 0, total: data.total });
            break;
          case 'domain_start':
            addLog(`Reindexing ${data.domain} (${data.count} records)...`, 'info');
            break;
          case 'progress':
            setProgress({ processed: data.processed, failed: data.failed, total: data.total });
            break;
          case 'error':
            addLog(`Error: ${data.domain}/${data.record_id}: ${data.message}`, 'error');
            break;
          case 'domain_done':
            addLog(`Finished ${data.domain}`, 'success');
            break;
          case 'done':
            addLog(`Reindex complete: ${data.processed} processed, ${data.failed} failed, ${data.skipped} skipped`, 'success');
            setProgress({ processed: data.processed, failed: data.failed, total: data.total });
            setRunning(false);
            es.close();
            break;
        }
      } catch { /* malformed event */ }
    };

    es.onerror = () => {
      addLog('Connection lost', 'error');
      setRunning(false);
      es.close();
    };
  };

  const stopReindex = () => {
    esRef.current?.close();
    setRunning(false);
    addLog('Reindex cancelled by user', 'error');
  };

  const pct = progress && progress.total > 0 ? Math.round(((progress.processed + progress.failed) / progress.total) * 100) : 0;

  return (
    <div style={{ padding: '10px 0', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={running ? stopReindex : startReindex}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 14px',
            background: running ? 'var(--surface)' : 'var(--amber)',
            color: running ? 'var(--error, #ef4444)' : '#06060a',
            border: running ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', fontWeight: 600,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          {running ? (
            <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Stop</>
          ) : (
            <><RotateCw size={14} /> Reindex all embeddings</>
          )}
        </button>
        {progress && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
            {progress.processed + progress.failed}/{progress.total} ({pct}%)
            {progress.failed > 0 && <span style={{ color: 'var(--error, #ef4444)' }}> — {progress.failed} failed</span>}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 0.3s',
            width: `${pct}%`,
            background: progress.failed > 0 ? 'var(--error, #ef4444)' : 'var(--amber)',
          }} />
        </div>
      )}

      {/* Log panel */}
      {logs.length > 0 && (
        <div
          ref={logRef}
          style={{
            maxHeight: 200, overflowY: 'auto',
            background: '#0a0a0f', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', border: '1px solid var(--border)',
          }}
        >
          {logs.map((log, i) => (
            <div key={i} style={{
              fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)',
              lineHeight: 1.6,
              color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : 'var(--text-dim)',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{log.time}</span>{' '}
              {log.text}
            </div>
          ))}
        </div>
      )}
    </div>
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
        {(() => {
          const current = ai.local_models.embedding_model;
          const embedModels = ai.local_models.available_models.filter(m => {
            const lower = m.toLowerCase();
            return lower.includes('embed') && !lower.includes('nomic');
          });
          // Always include the current value even if not installed yet
          if (current && !embedModels.includes(current)) embedModels.unshift(current);
          return embedModels.length > 0 ? (
            <SettingSelect
              label="Embedding Model"
              value={current}
              options={embedModels.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setLocalValue('ai.local_models.embedding_model', v)}
            />
          ) : (
            <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
              No embedding models installed. Run <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 2, fontSize: '0.6875rem' }}>ollama pull qwen3-embedding:0.6b</code>
            </div>
          );
        })()}
        <EmbeddingReindex />
        <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}>
          Tip: Ollama provides free local AI processing. Run <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 2, fontSize: '0.6875rem' }}>ollama pull &lt;model&gt;</code> to add more models.
        </div>
      </SettingSection>

      {/* Multimodal Model */}
      <SettingSection title="Multimodal Model" description="Ollama vision model for photo scene descriptions. Install via ollama pull qwen3-vl:2b.">
        <MultimodalModelSection />
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

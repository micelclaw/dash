/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Local Ollama runtime config + embedding reindex.
 * Moved out of Settings → AI Intelligence so the Gateway → Models → Advanced
 * tab is the single place for everything credentials/runtime/providers related.
 *
 * Persists through useSettingsStore.patchSettings({ ai: { local_models: ... } })
 * which writes immediately and updates `original`, so this block's saves do
 * not contaminate the AI section's dirty state.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, RotateCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface ReindexLog {
  time: string;
  text: string;
  type: 'info' | 'error' | 'success';
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

function EmbeddingReindex() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<ReindexLog[]>([]);
  const [progress, setProgress] = useState<{ processed: number; failed: number; total: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const addLog = useCallback((text: string, type: ReindexLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs((prev) => [...prev, { time, text, type }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const start = () => {
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

  const stop = () => {
    esRef.current?.close();
    setRunning(false);
    addLog('Reindex cancelled by user', 'error');
  };

  const pct = progress && progress.total > 0
    ? Math.round(((progress.processed + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <div style={{ padding: '10px 0', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={running ? stop : start}
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
            <><Loader2 size={14} className="spin" /> Stop</>
          ) : (
            <><RotateCw size={14} /> Reindex all embeddings</>
          )}
        </button>
        {progress && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
            {progress.processed + progress.failed}/{progress.total} ({pct}%)
            {progress.failed > 0 && (
              <span style={{ color: 'var(--error, #ef4444)' }}> — {progress.failed} failed</span>
            )}
          </span>
        )}
      </div>

      {progress && progress.total > 0 && (
        <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 0.3s',
            width: `${pct}%`,
            background: progress.failed > 0 ? 'var(--error, #ef4444)' : 'var(--amber)',
          }} />
        </div>
      )}

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
              <span style={{ color: 'var(--text-muted)' }}>{log.time}</span> {log.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LocalOllamaBlock() {
  const settings = useSettingsStore((s) => s.settings);
  const patchSettings = useSettingsStore((s) => s.patchSettings);

  const local = settings?.ai?.local_models;
  const [ollamaUrl, setOllamaUrl] = useState(local?.ollama_url ?? '');
  const [embeddingModel, setEmbeddingModel] = useState(local?.embedding_model ?? '');
  const [saving, setSaving] = useState(false);

  // Sync local state when settings load
  useEffect(() => {
    if (local) {
      setOllamaUrl(local.ollama_url);
      setEmbeddingModel(local.embedding_model);
    }
  }, [local?.ollama_url, local?.embedding_model]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!local) {
    return (
      <div style={{
        padding: 12,
        color: 'var(--text-dim)',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Loader2 size={12} className="spin" /> Loading local models...
      </div>
    );
  }

  const dirty = ollamaUrl !== local.ollama_url || embeddingModel !== local.embedding_model;

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchSettings({
        ai: {
          local_models: {
            ...local,
            ollama_url: ollamaUrl,
            embedding_model: embeddingModel,
          },
        },
      });
      toast.success('Local models updated');
    } catch {
      toast.error('Failed to update local models');
    } finally {
      setSaving(false);
    }
  };

  // Embedding model options: installed embedding models + current value (always)
  const embedModels = local.available_models.filter((m) => {
    const lower = m.toLowerCase();
    return lower.includes('embed') && !lower.includes('nomic');
  });
  if (embeddingModel && !embedModels.includes(embeddingModel)) {
    embedModels.unshift(embeddingModel);
  }

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
      }}>Local Ollama runtime</h3>
      <p style={{
        margin: '0 0 12px',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        lineHeight: 1.4,
      }}>
        Local Ollama instance for private models and embeddings. Run <code style={{
          background: 'var(--surface)', padding: '1px 4px', borderRadius: 2, fontSize: '0.6875rem',
        }}>ollama pull &lt;model&gt;</code> to install more models.
      </p>

      {/* URL */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Ollama URL</span>
        <input
          type="url"
          value={ollamaUrl}
          onChange={(e) => setOllamaUrl(e.target.value)}
          placeholder="http://127.0.0.1:11434"
          style={{
            flex: '0 0 280px', height: 30, padding: '0 8px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Status</span>
        <OllamaStatusBadge status={local.ollama_status} />
      </div>

      {/* Available models */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Available models</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {local.available_models.length > 0 ? (
            local.available_models.map((m) => (
              <span key={m} style={{
                fontSize: '0.75rem', padding: '2px 8px',
                background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)',
              }}>
                {m}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None detected</span>
          )}
        </div>
      </div>

      {/* Embedding model */}
      {embedModels.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Embedding model</span>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            style={{
              flex: '0 0 280px', height: 30, padding: '0 8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              outline: 'none', cursor: 'pointer',
            }}
          >
            {embedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          No embedding models installed. Run <code style={{
            background: 'var(--surface)', padding: '1px 4px', borderRadius: 2, fontSize: '0.6875rem',
          }}>ollama pull qwen3-embedding:0.6b</code>
        </div>
      )}

      {/* Save button (only when dirty) */}
      {dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', marginTop: 8,
            fontSize: '0.75rem', fontWeight: 600,
            background: 'var(--amber)', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            color: '#000', fontFamily: 'var(--font-sans)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Save size={12} /> Save
        </button>
      )}

      <EmbeddingReindex />
    </div>
  );
}

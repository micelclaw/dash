import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

interface MultimodalModelStatus {
  id: string;
  label: string;
  sizeBytes: number;
  downloaded: boolean;
  loaded: boolean;
}

interface PullState {
  downloaded: number;
  total: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '—';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function MultimodalModelSection() {
  const settings = useSettingsStore(s => s.settings);
  const setLocalValue = useSettingsStore(s => s.setLocalValue);
  const updateSection = useSettingsStore(s => s.updateSection);

  const [models, setModels] = useState<MultimodalModelStatus[]>([]);
  const [pulling, setPulling] = useState<Map<string, PullState>>(new Map());
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  const selectedModel = settings?.ai?.local_models?.multimodal_model ?? 'qwen3-vl:2b';

  const fetchModels = useCallback(async () => {
    try {
      const res = await api.get<{ data: MultimodalModelStatus[] }>('/photos/models/multimodal');
      setModels(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleSelect = async (id: string) => {
    setLocalValue('ai.local_models.multimodal_model', id);
    try {
      await updateSection('ai', { local_models: { ...settings!.ai.local_models, multimodal_model: id } });
    } catch {
      toast.error('Failed to save model selection');
    }
  };

  const handlePull = async (id: string) => {
    if (pulling.has(id)) return;

    const controller = new AbortController();
    abortRefs.current.set(id, controller);
    setPulling(prev => new Map(prev).set(id, { downloaded: 0, total: 0 }));

    let success = false;
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      const res = await fetch(
        `${BASE_URL}/api/v1/photos/models/multimodal/${encodeURIComponent(id)}/pull`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        },
      );

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let json: any;
          try { json = JSON.parse(line.slice(6)); } catch { continue; }
          if (json.error) throw new Error(json.error);
          if (json.status === 'done' || json.status === 'success') break outer;
          if (typeof json.completed === 'number' && typeof json.total === 'number' && json.total > 0) {
            setPulling(prev => new Map(prev).set(id, { downloaded: json.completed, total: json.total }));
          }
        }
      }

      success = true;
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(`Pull failed: ${err?.message ?? 'Unknown error'}`);
      }
    } finally {
      abortRefs.current.delete(id);
      setPulling(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      fetchModels();
    }

    if (success) toast.success(`${id} downloaded`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {models.map(m => {
        const isSelected = selectedModel === m.id;
        const isPulling = pulling.has(m.id);
        const pullState = pulling.get(m.id);
        const pct = pullState && pullState.total > 0
          ? Math.round((pullState.downloaded / pullState.total) * 100)
          : 0;

        return (
          <div
            key={m.id}
            onClick={() => !isPulling && handleSelect(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px',
              background: isSelected ? 'rgba(212, 160, 23, 0.08)' : 'var(--surface)',
              border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: isPulling ? 'default' : 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {/* Status dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: m.loaded && isSelected
                ? '#22c55e'
                : m.downloaded
                ? 'var(--amber)'
                : 'var(--border)',
            }} />

            {/* Name + size + progress */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 400, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', marginTop: 1 }}>
                {m.id} · {formatBytes(m.sizeBytes)}
              </div>
              {isPulling && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--amber)', borderRadius: 2,
                      width: pct > 0 ? `${pct}%` : '100%',
                      animation: pct === 0 ? 'mm-pulse 1.2s ease-in-out infinite' : 'none',
                      transition: pct > 0 ? 'width 0.3s' : 'none',
                    }} />
                  </div>
                  {pct > 0 && (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
                      {formatBytes(pullState!.downloaded)} / {formatBytes(pullState!.total)} · {pct}%
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pull button or status badge */}
            {!m.downloaded && !isPulling ? (
              <button
                onClick={(e) => { e.stopPropagation(); handlePull(m.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 26, padding: '0 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--amber)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)', fontWeight: 500,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Download size={11} />
                Pull
              </button>
            ) : (
              <span style={{
                fontSize: '0.625rem', padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)', fontWeight: 500,
                background: m.loaded && isSelected
                  ? 'rgba(34, 197, 94, 0.12)'
                  : m.downloaded
                  ? 'rgba(212, 160, 23, 0.12)'
                  : 'rgba(212, 160, 23, 0.08)',
                color: m.loaded && isSelected
                  ? '#22c55e'
                  : m.downloaded
                  ? 'var(--amber)'
                  : 'var(--amber)',
              }}>
                {m.loaded && isSelected
                  ? 'Active'
                  : m.downloaded
                  ? 'Installed'
                  : pct > 0 ? `${pct}%` : 'Pulling…'}
              </span>
            )}
          </div>
        );
      })}

      {models.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', padding: '8px 0' }}>
          Checking Ollama…
        </div>
      )}

      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 4, lineHeight: 1.4 }}>
        To install: <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 2 }}>ollama pull qwen3-vl:2b</code>
      </div>

      <style>{`
        @keyframes mm-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

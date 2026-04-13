/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama (local, free)' },
  { value: 'openai', label: 'OpenAI (cloud, requires API key)' },
  { value: 'gemini', label: 'Google Gemini (cloud, requires API key)' },
  { value: 'voyage', label: 'Voyage AI (cloud)' },
  { value: 'mistral', label: 'Mistral (cloud)' },
  { value: 'local', label: 'Local GGUF model (no network)' },
];

const BACKENDS = [
  { value: 'builtin', label: 'Built-in SQLite (default, in-process)' },
  { value: 'qmd', label: 'QMD sidecar (separate process, advanced)' },
];

function Section({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px',
        background: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '0.8125rem',
        fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left',
      }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {expanded && <div style={{ padding: '8px 16px 16px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
      background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)',
      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s' }} />
    </div>
  );
}

export function MemorySearchSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ search: true, sync: false, backend: false });

  const [provider, setProvider] = useState('ollama');
  const [enabled, setEnabled] = useState(true);
  const [hybridEnabled, setHybridEnabled] = useState(true);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [textWeight, setTextWeight] = useState(0.3);
  const [temporalDecay, setTemporalDecay] = useState(false);
  const [halfLifeDays, setHalfLifeDays] = useState(30);
  const [mmrEnabled, setMmrEnabled] = useState(false);
  const [mmrLambda, setMmrLambda] = useState(0.7);
  const [maxResults, setMaxResults] = useState(8);
  const [minScore, setMinScore] = useState(0.1);
  const [chunkTokens, setChunkTokens] = useState(400);
  const [chunkOverlap, setChunkOverlap] = useState(80);
  const [syncOnStart, setSyncOnStart] = useState(true);
  const [syncWatch, setSyncWatch] = useState(true);
  const [syncOnSearch, setSyncOnSearch] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60);
  const [backend, setBackend] = useState('builtin');
  const [citations, setCitations] = useState('auto');
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getMemoryConfig();
      const ms = data.memory_search ?? {};
      const mem = data.memory ?? {};
      setProvider((ms.provider ?? 'ollama') as string);
      setEnabled((ms.enabled ?? true) as boolean);
      const q = (ms.query ?? {}) as Record<string, unknown>;
      setMaxResults((q.max_results ?? 8) as number);
      setMinScore((q.min_score ?? 0.1) as number);
      const h = (q.hybrid ?? {}) as Record<string, unknown>;
      setHybridEnabled((h.enabled ?? true) as boolean);
      setVectorWeight((h.vector_weight ?? 0.7) as number);
      setTextWeight((h.text_weight ?? 0.3) as number);
      const td = (h.temporal_decay ?? {}) as Record<string, unknown>;
      setTemporalDecay((td.enabled ?? false) as boolean);
      setHalfLifeDays((td.half_life_days ?? 30) as number);
      const mmr = (h.mmr ?? {}) as Record<string, unknown>;
      setMmrEnabled((mmr.enabled ?? false) as boolean);
      setMmrLambda((mmr.lambda ?? 0.7) as number);
      const ch = (ms.chunking ?? {}) as Record<string, unknown>;
      setChunkTokens((ch.tokens ?? 400) as number);
      setChunkOverlap((ch.overlap ?? 80) as number);
      const sy = (ms.sync ?? {}) as Record<string, unknown>;
      setSyncOnStart((sy.on_session_start ?? true) as boolean);
      setSyncWatch((sy.watch ?? true) as boolean);
      setSyncOnSearch((sy.on_search ?? false) as boolean);
      setSyncInterval((sy.interval_minutes ?? 60) as number);
      const ca = (ms.cache ?? {}) as Record<string, unknown>;
      setCacheEnabled((ca.enabled ?? true) as boolean);
      setBackend((mem.backend ?? 'builtin') as string);
      setCitations((mem.citations ?? 'auto') as string);
      setDirty(false);
    } catch { toast.error('Failed to load memory config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateMemoryConfig({
        memorySearch: {
          enabled, provider,
          chunking: { tokens: chunkTokens, overlap: chunkOverlap },
          sync: { onSessionStart: syncOnStart, onSearch: syncOnSearch, watch: syncWatch, intervalMinutes: syncInterval },
          query: {
            maxResults, minScore,
            hybrid: {
              enabled: hybridEnabled, vectorWeight, textWeight,
              mmr: { enabled: mmrEnabled, lambda: mmrLambda },
              temporalDecay: { enabled: temporalDecay, halfLifeDays },
            },
          },
          cache: { enabled: cacheEnabled },
        },
        memory: { backend, citations },
      });
      toast.success('Memory config updated');
      setDirty(false);
    } catch { toast.error('Failed to update memory config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  const Sel = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '4px 8px', fontSize: '0.75rem', minWidth: 200, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)',
      fontFamily: 'var(--font-sans)', cursor: 'pointer',
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Num = ({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <input type="number" value={value} min={min} max={max} onChange={e => onChange(parseFloat(e.target.value) || min)} style={{
      padding: '4px 8px', fontSize: '0.75rem', width: 70, textAlign: 'right', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    }} />
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Memory Search</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            How agents search their persistent memory (MEMORY.md + daily notes).
          </p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
          background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default',
          opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)',
        }}><Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button>
      </div>

      <Row label="Memory search enabled" desc="Allow agents to search their memory files"><Toggle value={enabled} onChange={d(setEnabled)} /></Row>
      <Row label="Embedding provider" desc="Service that generates vector embeddings for semantic search"><Sel value={provider} options={PROVIDERS} onChange={d(setProvider)} /></Row>

      <Section title="Search Quality" expanded={sections.search!} onToggle={() => setSections(p => ({ ...p, search: !p.search }))}>
        <Row label="Max results" desc="Number of memory snippets returned per search"><Num value={maxResults} min={1} max={30} onChange={d(setMaxResults)} /></Row>
        <Row label="Min score threshold" desc="Minimum relevance score (0-1). Lower = more results, less relevant"><Num value={minScore} min={0} max={1} onChange={d(setMinScore)} /></Row>
        <Row label="Hybrid search" desc="Combine vector similarity + keyword matching"><Toggle value={hybridEnabled} onChange={d(setHybridEnabled)} /></Row>
        {hybridEnabled && <>
          <Row label="Vector weight" desc="How much weight to give semantic similarity (0-1)"><Num value={vectorWeight} min={0} max={1} onChange={d(setVectorWeight)} /></Row>
          <Row label="Text weight" desc="How much weight to give keyword matching (0-1)"><Num value={textWeight} min={0} max={1} onChange={d(setTextWeight)} /></Row>
        </>}
        <Row label="Temporal decay" desc="Penalize older notes (recent info ranks higher)"><Toggle value={temporalDecay} onChange={d(setTemporalDecay)} /></Row>
        {temporalDecay && <Row label="Half-life (days)" desc="Days until a note's score drops to 50%"><Num value={halfLifeDays} min={1} max={365} onChange={d(setHalfLifeDays)} /></Row>}
        <Row label="MMR diversity" desc="Avoid redundant near-duplicate results"><Toggle value={mmrEnabled} onChange={d(setMmrEnabled)} /></Row>
        {mmrEnabled && <Row label="MMR lambda" desc="0=max diversity, 1=pure relevance"><Num value={mmrLambda} min={0} max={1} onChange={d(setMmrLambda)} /></Row>}
        <Row label="Chunk size (tokens)" desc="Size of each indexed fragment"><Num value={chunkTokens} min={100} max={2000} onChange={d(setChunkTokens)} /></Row>
        <Row label="Chunk overlap (tokens)" desc="Overlap between consecutive chunks"><Num value={chunkOverlap} min={0} max={500} onChange={d(setChunkOverlap)} /></Row>
      </Section>

      <Section title="Indexing & Sync" expanded={sections.sync!} onToggle={() => setSections(p => ({ ...p, sync: !p.sync }))}>
        <Row label="Sync on session start" desc="Re-index when a new chat session begins"><Toggle value={syncOnStart} onChange={d(setSyncOnStart)} /></Row>
        <Row label="File watcher" desc="Auto-index when memory files change"><Toggle value={syncWatch} onChange={d(setSyncWatch)} /></Row>
        <Row label="Sync before every search" desc="Guarantee fresh results (slower)"><Toggle value={syncOnSearch} onChange={d(setSyncOnSearch)} /></Row>
        <Row label="Background sync interval (min)" desc="Periodic re-index interval. 0 = disabled"><Num value={syncInterval} min={0} max={1440} onChange={d(setSyncInterval)} /></Row>
        <Row label="Embedding cache" desc="Cache embeddings to avoid re-computing unchanged chunks"><Toggle value={cacheEnabled} onChange={d(setCacheEnabled)} /></Row>
      </Section>

      <Section title="Backend" expanded={sections.backend!} onToggle={() => setSections(p => ({ ...p, backend: !p.backend }))}>
        <Row label="Memory backend" desc="Search engine backend"><Sel value={backend} options={BACKENDS} onChange={d(setBackend)} /></Row>
        <Row label="Citations" desc="Show source file + line in search results">
          <Sel value={citations} options={[
            { value: 'auto', label: 'Auto' }, { value: 'on', label: 'Always' }, { value: 'off', label: 'Never' },
          ]} onChange={d(setCitations)} />
        </Row>
      </Section>
    </div>
  );
}

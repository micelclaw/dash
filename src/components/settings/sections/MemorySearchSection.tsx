/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// Lista canónica del speech-provider registry de OpenClaw 2026.5.7.
// Para añadir nuevos en futuras versiones: grep
//   `createXxxEmbeddingProvider` en /usr/lib/node_modules/openclaw/dist/*.js
// y mirar `extensions/<id>/embedding-provider.ts`.
//
// Orden: local primero → cloud free-tier → cloud API-key mainstream → enterprise.
//
// NO incluidos:
// - "Ollama Web Search" — es un provider del tool `web_search` (no de
//   embeddings; ver `extensions/ollama/src/web-search-provider.ts`). Cuando
//   tengamos UI para web search providers, va ahí.
// - Bedrock model sub-selector (titan-v1/v2 · cohere · nova · twelvelabs)
//   se elige via `provider.model` field del config (no en este selector).
const PROVIDERS = [
  // Local — no network, no API key
  { value: 'ollama',          label: 'Ollama (local, free)' },
  { value: 'lmstudio',        label: 'LM Studio (local, free)' },
  { value: 'local',           label: 'Local GGUF model (no network)' },
  // Cloud free-tier / generous
  { value: 'gemini',          label: 'Google Gemini (cloud, API key)' },
  // Cloud API-key mainstream
  { value: 'openai',          label: 'OpenAI (cloud, API key)' },
  { value: 'voyage',          label: 'Voyage AI (cloud, API key; asymmetric inputType)' },
  { value: 'mistral',         label: 'Mistral (cloud, API key)' },
  { value: 'deepinfra',       label: 'DeepInfra (cloud, API key; open-model proxy)' },
  { value: 'github-copilot',  label: 'GitHub Copilot (cloud, OAuth)' },
  // Enterprise
  { value: 'bedrock',         label: 'Amazon Bedrock (enterprise; Titan/Cohere/Nova/TwelveLabs)' },
];

/**
 * Inline hint shown under the selector for the active provider — typical
 * model ids, where to put the API key, regional quirks. Keep each entry
 * to one short line so the layout stays compact.
 */
const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  ollama:           'Local, free. Default model: nomic-embed-text. Recommended baseline if you run Ollama locally.',
  lmstudio:         'Local, free. Loads embedding models via the LM Studio app (port 1234 by default).',
  local:            'Embed inline via a GGUF model file — no network, no separate process. Slower than Ollama for big indexes.',
  gemini:           'Google AI Studio API key required. Models: text-embedding-004, gemini-embedding-exp.',
  openai:           'API key required (Settings → AI → API Keys). Models: text-embedding-3-small / text-embedding-3-large.',
  voyage:           'API key required. Models: voyage-3, voyage-3-large, voyage-code-3. Supports asymmetric inputType (set below).',
  mistral:          'API key required. Single model: mistral-embed.',
  deepinfra:        'API key required. Proxy to many open-source models (BGE, E5, Jina, etc.) at OpenAI-compatible endpoints.',
  'github-copilot': 'GitHub Copilot OAuth — same auth flow as Copilot chat. Cheap if you already pay for Copilot.',
  bedrock:          'AWS credentials + region required. Model family selected by the configured model id (titan-v1/v2 · cohere · nova · twelvelabs). Cohere variants also support asymmetric inputType (set below).',
};

const BACKENDS = [
  { value: 'builtin', label: 'Built-in SQLite (default, in-process)' },
  { value: 'qmd', label: 'QMD sidecar (separate process, advanced)' },
];

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
  return <ToggleSwitch checked={value} onChange={onChange} />;
}

export function MemorySearchSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ search: true, sync: false, backend: false, advanced: false });

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
  // Asymmetric inputType — only meaningful for voyage and bedrock (cohere
  // family). Empty string = use the provider's default. Other providers
  // ignore the fields if set; we still persist them so a future provider
  // switch back to voyage/bedrock restores the user's intent.
  const [queryInputType, setQueryInputType] = useState('');
  const [documentInputType, setDocumentInputType] = useState('');

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
      // Asymmetric inputType (snake_case from API per case-transform plugin).
      setQueryInputType((ms.query_input_type ?? '') as string);
      setDocumentInputType((ms.document_input_type ?? '') as string);
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to load memory config')); }
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
          // Asymmetric inputType — only sent when non-empty so we don't
          // pollute the config with empty strings (the runtime uses the
          // provider's default when these are missing).
          ...(queryInputType ? { queryInputType } : {}),
          ...(documentInputType ? { documentInputType } : {}),
        },
        memory: { backend, citations },
      });
      toast.success('Memory saved');
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to update memory config')); }
    finally { setSaving(false); }
  };


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

  const Txt = ({ value, placeholder, onChange }: { value: string; placeholder?: string; onChange: (v: string) => void }) => (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '4px 8px', fontSize: '0.75rem', width: 180, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    />
  );

  return (
    <SectionShell
      title="Memory Search"
      description="How agents search their persistent memory (MEMORY.md + daily notes)."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      <Row label="Memory search enabled" desc="Allow agents to search their memory files"><Toggle value={enabled} onChange={d(setEnabled)} /></Row>
      <Row label="Embedding provider" desc="Service that generates vector embeddings for semantic search"><Sel value={provider} options={PROVIDERS} onChange={d(setProvider)} /></Row>
      {PROVIDER_DESCRIPTIONS[provider] && (
        <div style={{ padding: '0 0 8px 0', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
          {PROVIDER_DESCRIPTIONS[provider]}
        </div>
      )}

      {(provider === 'voyage' || provider === 'bedrock') && (
        <SettingsBlock
          title="Asymmetric inputType (advanced)"
          expanded={sections.advanced!}
          onToggle={() => setSections(p => ({ ...p, advanced: !p.advanced }))}
        >
          <div style={{ padding: '4px 0 8px 0', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Some embedding providers expose different optimisations for embedding QUERIES vs DOCUMENTS. When set, the runtime uses these instead of the provider's generic <code>inputType</code>. Leave blank for the provider default.
          </div>
          <Row
            label="Query inputType"
            desc="Voyage: query · Cohere/Bedrock: search_query"
          >
            <Txt value={queryInputType} placeholder="e.g. query" onChange={d(setQueryInputType)} />
          </Row>
          <Row
            label="Document inputType"
            desc="Voyage: document · Cohere/Bedrock: search_document"
          >
            <Txt value={documentInputType} placeholder="e.g. document" onChange={d(setDocumentInputType)} />
          </Row>
        </SettingsBlock>
      )}

      <SettingsBlock title="Search Quality" expanded={sections.search!} onToggle={() => setSections(p => ({ ...p, search: !p.search }))}>
        <Row label="Max results" desc="How many memory snippets the agent gets back per search. More = richer context but slower."><Num value={maxResults} min={1} max={30} onChange={d(setMaxResults)} /></Row>
        <Row label="Min relevance" desc="Drop snippets below this score (0–1). Lower lets through more, including weaker matches. Try 0.1 for broad recall, 0.3 for stricter."><Num value={minScore} min={0} max={1} onChange={d(setMinScore)} /></Row>
        <Row label="Hybrid search" desc="Combines semantic similarity (meaning) with keyword matching. Catches both 'laptop battery' and exact tag matches. Recommended."><Toggle value={hybridEnabled} onChange={d(setHybridEnabled)} /></Row>
        {hybridEnabled && <>
          <Row label="Semantic weight" desc="Importance of meaning-based matches. 0.7 = mostly semantic, 0.3 = mostly keyword. Should sum with text weight to 1.0."><Num value={vectorWeight} min={0} max={1} onChange={d(setVectorWeight)} /></Row>
          <Row label="Keyword weight" desc="Importance of exact-word matches. Higher helps when the user uses specific terms or jargon."><Num value={textWeight} min={0} max={1} onChange={d(setTextWeight)} /></Row>
        </>}
        <Row label="Prefer recent" desc="Recent notes rank higher than old ones. Useful for journaling / daily notes where freshness matters."><Toggle value={temporalDecay} onChange={d(setTemporalDecay)} /></Row>
        {temporalDecay && <Row label="Half-life (days)" desc="A note this many days old is worth half what it was when fresh. 30 = strong decay, 365 = barely any."><Num value={halfLifeDays} min={1} max={365} onChange={d(setHalfLifeDays)} /></Row>}
        <Row label="Avoid duplicates" desc="Skip near-identical results so the agent doesn't see the same idea five times. Useful for big memory archives."><Toggle value={mmrEnabled} onChange={d(setMmrEnabled)} /></Row>
        {mmrEnabled && <Row label="Diversity vs relevance" desc="0 = maximum diversity (variety wins). 1 = ignore diversity (relevance wins). 0.7 is a balanced default."><Num value={mmrLambda} min={0} max={1} onChange={d(setMmrLambda)} /></Row>}
        <Row label="Chunk size (tokens)" desc="How large each piece of memory is when indexed. Smaller (200) = more precise matches, larger (800) = more context per match."><Num value={chunkTokens} min={100} max={2000} onChange={d(setChunkTokens)} /></Row>
        <Row label="Chunk overlap (tokens)" desc="How much consecutive chunks share. Prevents losing info that falls on chunk boundaries. Usually 10–20% of chunk size."><Num value={chunkOverlap} min={0} max={500} onChange={d(setChunkOverlap)} /></Row>
      </SettingsBlock>

      <SettingsBlock title="Indexing & Sync" expanded={sections.sync!} onToggle={() => setSections(p => ({ ...p, sync: !p.sync }))}>
        <Row label="Sync on session start" desc="Re-index when a new chat session begins"><Toggle value={syncOnStart} onChange={d(setSyncOnStart)} /></Row>
        <Row label="File watcher" desc="Auto-index when memory files change"><Toggle value={syncWatch} onChange={d(setSyncWatch)} /></Row>
        <Row label="Sync before every search" desc="Guarantee fresh results (slower)"><Toggle value={syncOnSearch} onChange={d(setSyncOnSearch)} /></Row>
        <Row label="Background sync interval (min)" desc="Periodic re-index interval. 0 = disabled"><Num value={syncInterval} min={0} max={1440} onChange={d(setSyncInterval)} /></Row>
        <Row label="Embedding cache" desc="Cache embeddings to avoid re-computing unchanged chunks"><Toggle value={cacheEnabled} onChange={d(setCacheEnabled)} /></Row>
      </SettingsBlock>

      <SettingsBlock title="Backend" expanded={sections.backend!} onToggle={() => setSections(p => ({ ...p, backend: !p.backend }))}>
        <Row label="Memory backend" desc="Search engine backend"><Sel value={backend} options={BACKENDS} onChange={d(setBackend)} /></Row>
        <Row label="Citations" desc="Show source file + line in search results">
          <Sel value={citations} options={[
            { value: 'auto', label: 'Auto' }, { value: 'on', label: 'Always' }, { value: 'off', label: 'Never' },
          ]} onChange={d(setCitations)} />
        </Row>
      </SettingsBlock>
    </SectionShell>
  );
}

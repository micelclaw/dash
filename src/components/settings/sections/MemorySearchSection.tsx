/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, ChevronRight } from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import type { SecretProvider } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SecretInputField, type SecretInputValue } from '@/components/shared/SecretInputField';

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

  // G7: LanceDB cloud storage state ------------------------------------------
  const [storagePreset, setStoragePreset] = useState<'aws-s3' | 'r2' | 'b2' | 'minio' | 'custom'>('aws-s3');
  const [r2AccountId, setR2AccountId] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState<SecretInputValue>({ mode: 'plain', value: '' });
  const [secretKey, setSecretKey] = useState<SecretInputValue>({ mode: 'plain', value: '' });
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [secretProviders, setSecretProviders] = useState<Record<string, SecretProvider>>({});
  const [testing, setTesting] = useState(false);
  const [initing, setIniting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

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

      // G7: hydrate LanceDB cloud storage state from memory-lancedb plugin config
      const lance = (data.memory_lancedb ?? {}) as Record<string, unknown>;
      const dbPath = (lance.db_path ?? '') as string;
      const storage = (lance.storage_options ?? {}) as Record<string, string>;
      // Parse s3://bucket/prefix → bucket + prefix
      const uriMatch = dbPath.match(/^(s3|r2|gs|az):\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])(\/(.*))?$/);
      if (uriMatch) {
        setS3Bucket(uriMatch[2]);
        setS3Prefix(uriMatch[4] ?? '');
      }
      setS3Endpoint((storage.endpoint ?? '') as string);
      setS3Region((storage.region ?? 'us-east-1') as string);
      // Detect preset by endpoint pattern
      const ep = (storage.endpoint ?? '') as string;
      if (ep.includes('r2.cloudflarestorage.com')) {
        setStoragePreset('r2');
        const m = ep.match(/https?:\/\/([a-z0-9]+)\.r2\.cloudflarestorage\.com/);
        if (m) setR2AccountId(m[1]);
      } else if (ep.includes('backblazeb2.com')) setStoragePreset('b2');
      else if (ep && !ep.includes('amazonaws.com')) setStoragePreset('minio');
      else if (uriMatch) setStoragePreset('aws-s3');
      // Hydrate credentials: detect ${REF} pattern → reference mode
      const ak = (storage.access_key_id ?? '') as string;
      const sk = (storage.secret_access_key ?? '') as string;
      const refRe = /^\$\{([A-Za-z0-9_-]+)\}$/;
      const akRef = ak.match(refRe);
      const skRef = sk.match(refRe);
      setAccessKey(akRef
        ? { mode: 'ref', source: 'env', provider: akRef[1], id: akRef[1] }
        : { mode: 'plain', value: ak });
      setSecretKey(skRef
        ? { mode: 'ref', source: 'env', provider: skRef[1], id: skRef[1] }
        : { mode: 'plain', value: sk });

      // Load secret providers for the SecretInputField dropdown (best-effort)
      try {
        const secretsCfg = await gwService.getSecretsConfig();
        setSecretProviders(secretsCfg.providers ?? {});
      } catch {
        // Silent: SecretInputField shows the "no providers configured" hint
      }

      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to load memory config')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  // G7 helpers ----------------------------------------------------------------
  const PRESET_DEFAULTS: Record<string, { endpoint: string; region: string }> = {
    'aws-s3': { endpoint: '', region: 'us-east-1' },
    r2: { endpoint: r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : '', region: 'auto' },
    b2: { endpoint: 'https://s3.us-west-002.backblazeb2.com', region: 'us-west-002' },
    minio: { endpoint: 'http://localhost:9000', region: 'us-east-1' },
    custom: { endpoint: '', region: 'us-east-1' },
  };
  const applyPreset = (next: typeof storagePreset) => {
    setStoragePreset(next);
    const defaults = PRESET_DEFAULTS[next];
    setS3Endpoint(defaults.endpoint);
    setS3Region(defaults.region);
    setDirty(true);
    setTestStatus('idle');
  };
  const serializeSecret = (v: SecretInputValue): string => {
    if (v.mode === 'plain') return v.value;
    return v.provider ? `\${${v.provider}}` : '';
  };
  const buildDbPath = (): string => {
    if (!s3Bucket) return '';
    const scheme = storagePreset === 'r2' ? 's3' : 's3'; // r2 uses s3 scheme too (LanceDB convention)
    const prefix = s3Prefix ? `/${s3Prefix.replace(/^\/+|\/+$/g, '')}` : '';
    return `${scheme}://${s3Bucket}${prefix}`;
  };
  const buildStorageOptions = (): Record<string, string> => {
    const opts: Record<string, string> = {};
    if (s3Endpoint) opts.endpoint = s3Endpoint;
    if (s3Region) opts.region = s3Region;
    const ak = serializeSecret(accessKey);
    const sk = serializeSecret(secretKey);
    if (ak) opts.access_key_id = ak;
    if (sk) opts.secret_access_key = sk;
    return opts;
  };
  const isCloudConfigured = !!s3Bucket && !!serializeSecret(accessKey) && !!serializeSecret(secretKey);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus('idle');
    setTestMessage('');
    try {
      const result = await gwService.testLanceDbConnection({
        dbPath: buildDbPath(),
        storageOptions: buildStorageOptions(),
      });
      if (result.ok) {
        setTestStatus('ok');
        setTestMessage(`Bucket reachable (${result.region}, ${result.object_count ?? 0} obj in prefix)`);
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Connection failed');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(describeError(err, 'Test failed'));
    } finally {
      setTesting(false);
    }
  };

  const handleInitBucket = async () => {
    setIniting(true);
    try {
      const result = await gwService.initLanceDbBucket({
        dbPath: buildDbPath(),
        storageOptions: buildStorageOptions(),
      });
      if (result.ok && result.created) {
        toast.success('Bucket initialized — marker written successfully');
      } else if (result.ok && result.warning) {
        toast.warning(result.warning, { duration: 8000 });
      } else {
        toast.error(result.error || 'Init failed');
      }
    } catch (err) {
      toast.error(describeError(err, 'Init failed'));
    } finally {
      setIniting(false);
    }
  };

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
        // G7: only emit memoryLancedb when the user has configured a bucket.
        // Empty object would clobber existing config; null would delete it.
        ...(s3Bucket
          ? { memoryLancedb: { dbPath: buildDbPath(), storageOptions: buildStorageOptions() } }
          : {}),
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

      <SettingsBlock
        title="Cloud storage (S3-compatible)"
        expanded={sections.cloud ?? false}
        onToggle={() => setSections(p => ({ ...p, cloud: !p.cloud }))}
      >
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
          Point the LanceDB plugin (<code style={{ fontFamily: 'var(--font-mono)' }}>@openclaw/memory-lancedb</code>) at an S3-compatible bucket instead of local disk. Useful for shared embeddings across nodes or off-host backups.
        </p>

        <Row label="Provider preset" desc="Pre-fills endpoint & region for common S3-compatible services">
          <Sel
            value={storagePreset}
            options={[
              { value: 'aws-s3', label: 'AWS S3' },
              { value: 'r2', label: 'Cloudflare R2' },
              { value: 'b2', label: 'Backblaze B2' },
              { value: 'minio', label: 'MinIO (self-hosted)' },
              { value: 'custom', label: 'Custom endpoint' },
            ]}
            onChange={(v) => applyPreset(v as typeof storagePreset)}
          />
        </Row>

        {storagePreset === 'r2' && (
          <Row label="R2 account ID" desc="Cloudflare account hash (32 hex chars)">
            <input
              type="text"
              value={r2AccountId}
              onChange={(e) => {
                setR2AccountId(e.target.value);
                setS3Endpoint(e.target.value ? `https://${e.target.value}.r2.cloudflarestorage.com` : '');
                setDirty(true);
              }}
              placeholder="a1b2c3d4e5f6..."
              style={inputStyle}
            />
          </Row>
        )}

        <Row label="Bucket name" desc="Name of the S3 bucket — must already exist">
          <input
            type="text"
            value={s3Bucket}
            onChange={(e) => d(setS3Bucket)(e.target.value)}
            placeholder="my-memory-backup"
            style={inputStyle}
          />
        </Row>
        <Row label="Path prefix" desc="Optional sub-directory inside the bucket">
          <input
            type="text"
            value={s3Prefix}
            onChange={(e) => d(setS3Prefix)(e.target.value)}
            placeholder="prod/lance"
            style={inputStyle}
          />
        </Row>
        <Row label="Endpoint URL" desc="Leave empty for AWS S3 (region-derived)">
          <input
            type="text"
            value={s3Endpoint}
            onChange={(e) => d(setS3Endpoint)(e.target.value)}
            placeholder="https://s3.eu-west-1.amazonaws.com"
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
        </Row>
        <Row label="Region" desc="Bucket region — e.g. us-east-1, eu-west-1, auto (R2)">
          <input
            type="text"
            value={s3Region}
            onChange={(e) => d(setS3Region)(e.target.value)}
            placeholder="us-east-1"
            style={inputStyle}
          />
        </Row>

        <div style={{ marginTop: 12, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', margin: '0 0 10px 0', fontWeight: 600 }}>
            Credentials
          </h4>
          <div style={{ marginBottom: 12 }}>
            <SecretInputField
              label="Access key ID"
              value={accessKey}
              onChange={(v) => { setAccessKey(v); setDirty(true); }}
              providers={secretProviders}
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
          </div>
          <SecretInputField
            label="Secret access key"
            value={secretKey}
            onChange={(v) => { setSecretKey(v); setDirty(true); }}
            providers={secretProviders}
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!isCloudConfigured || testing}
            onClick={handleTestConnection}
            style={buttonStyle(testing)}
          >
            {testing && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Test connection
          </button>
          <button
            type="button"
            disabled={!isCloudConfigured || initing}
            onClick={handleInitBucket}
            style={buttonStyle(initing)}
          >
            {initing && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Initialize bucket
          </button>
          {testStatus !== 'idle' && (
            <span style={{
              fontSize: '0.75rem',
              color: testStatus === 'ok' ? '#10b981' : 'var(--red)',
            }}>
              {testStatus === 'ok' ? '✓ ' : '✗ '}{testMessage}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setHelpExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginTop: 16, padding: '4px 0',
            background: 'transparent', border: 'none',
            color: 'var(--text-dim)', fontSize: '0.75rem',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronRight size={12} style={{ transform: helpExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          Migrating existing data?
        </button>
        {helpExpanded && (
          <div style={{
            marginTop: 8, padding: '12px 14px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem', color: 'var(--text-dim)',
            lineHeight: 1.6,
          }}>
            The plugin does not expose a native migrate command. To move an existing
            local LanceDB store to the bucket, sync the files directly with the AWS CLI:
            <pre style={{
              margin: '8px 0 0 0', padding: '8px 10px',
              background: 'var(--card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem', color: 'var(--text)',
              overflowX: 'auto',
            }}>
{`aws s3 sync ~/.openclaw/memory/lancedb/ s3://${s3Bucket || '<bucket>'}/${s3Prefix || '<prefix>'}/`}
            </pre>
            LanceDB stores standard Parquet/Lance files, so a plain S3 sync works.
            After migration, save the config here and restart Core for the plugin to pick up the new path.
          </div>
        )}
      </SettingsBlock>
    </SectionShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '0.75rem',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
};
function buttonStyle(busy: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px',
    fontSize: '0.75rem',
    background: busy ? 'var(--surface)' : 'var(--amber-dim)',
    color: busy ? 'var(--text-dim)' : 'var(--amber)',
    border: '1px solid ' + (busy ? 'var(--border)' : 'transparent'),
    borderRadius: 'var(--radius-sm)',
    cursor: busy ? 'wait' : 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  };
}

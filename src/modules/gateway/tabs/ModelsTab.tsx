/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Star, Cpu, RefreshCw, Search as SearchIcon, Image, Plus, X, Check, Key, ArrowLeft, ChevronRight, Trash2, Loader2, Pencil, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { StatusPill } from '../components/StatusPill';
import { ModelSetupWizard } from '../components/ModelSetupWizard';
import { getProviderIcon } from '@/config/provider-icons';
import { ModelsAdvancedView } from '../components/ModelsAdvancedView';
import { CustomModelConfigModal } from '../components/CustomModelConfigModal';
import { OllamaModelSettingsModal } from '../components/OllamaModelSettingsModal';
import { AddModelPanel } from '../components/AddModelPanel';
import { GpuCoordinationPanel } from '../components/GpuCoordinationPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GatewayModel, CatalogModel } from '../types';

const PROVIDER_COLORS: Record<string, string> = {
  // Mainstream
  anthropic: '#d4a017',
  openai: '#10b981',
  'openai-codex': '#10b981',
  openrouter: '#6366f1',
  gemini: '#4285F4',
  google: '#4285F4',
  'google-vertex': '#4285F4',
  vertexai: '#4285F4',
  mistral: '#f97316',
  ollama: '#0ea5e9',
  deepseek: '#5b6ee1',
  'amazon-bedrock': '#ff9900',
  bedrock: '#ff9900',
  groq: '#f55036',
  together: '#6366f1',
  fireworks: '#ff6b35',
  cerebras: '#00d4aa',
  xai: '#999999',
  cohere: '#39594d',
  // New (2026.5.7 + brand-recognised)
  nvidia: '#76B900',
  deepinfra: '#2563eb',
  arcee: '#7c3aed',
  'github-copilot': '#9CA3AF',
  copilot: '#9CA3AF',
  huggingface: '#FF9D00',
  byteplus: '#1d4ed8',
  'byteplus-plan': '#1d4ed8',
  cloudflare: '#f6821f',
  'cloudflare-ai-gateway': '#f6821f',
  'cloudflare-workers-ai': '#f6821f',
  microsoft: '#0078d4',
  azure: '#0078d4',
  'azure-openai-responses': '#0078d4',
  minimax: '#0066ff',
  'minimax-cn': '#0066ff',
  moonshot: '#16a085',
  moonshotai: '#16a085',
  'moonshotai-cn': '#16a085',
  'kimi-coding': '#16a085',
  voyage: '#7c3aed',
  'lm-studio': '#374151',
  lmstudio: '#374151',
  vllm: '#0ea5e9',
  opencode: '#9CA3AF',
  'opencode-go': '#9CA3AF',
  xiaomi: '#ff6900',
  'xiaomi-mimo': '#ff6900',
  // Round 2 (extra logos)
  alibaba: '#ff6a00',
  qwen: '#615ced',
  baidu: '#2932e1',
  qianfan: '#2932e1',
  elevenlabs: '#9CA3AF',
  exa: '#1e40af',
  fal: '#ec4899',
  kilocode: '#6366f1',
  perplexity: '#1f7a8c',
  runway: '#9CA3AF',
  senseaudio: '#ff6b6b',
  sensenova: '#ff6b6b',
  stepfun: '#00b1ff',
  tavily: '#4b5cf3',
  tencent: '#1d61ff',
  venice: '#d4af37',
  vercel: '#9CA3AF',
  'vercel-ai-gateway': '#9CA3AF',
  volcengine: '#1664ff',
  zai: '#6366f1',
  'anthropic-vertex': '#d4a017',
  'amazon-bedrock-mantle': '#ff9900',
  'azure-speech': '#0078d4',
  'microsoft-foundry': '#0078d4',
  // Round 3 (custom abstract glyphs — no lobehub coverage)
  chutes: '#3b82f6',
  deepgram: '#13ef93',
  firecrawl: '#fa5d19',
  gradium: '#a855f7',
  inworld: '#0ea5e9',
  litellm: '#22c55e',
  searxng: '#3050ff',
  sglang: '#475569',
  synthetic: '#10b981',
  tokenjuice: '#84cc16',
  vydra: '#ec4899',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  xai: 'xAI (Grok)',
  mistral: 'Mistral',
  cohere: 'Cohere',
  together: 'Together AI',
  fireworks: 'Fireworks',
  cerebras: 'Cerebras',
  ollama: 'Ollama',
  'amazon-bedrock': 'Amazon Bedrock',
  'hugging-face': 'Hugging Face',
  'venice-ai': 'Venice AI',
  litellm: 'LiteLLM',
  chutes: 'Chutes',
  minimax: 'MiniMax',
  qwen: 'Qwen',
};

type View = 'configured' | 'catalog' | 'advanced';
type CatalogSubView = 'providers' | 'models';

// Providers that the user installs/configures from the dash wizard.
// Custom providers follow the `custom-api-*` convention; the local-server
// providers have fixed IDs aligned with the OpenClaw CLI.
const USER_MANAGED_FIXED_PROVIDERS = new Set(['ollama', 'vllm', 'sglang', 'lm-studio']);
function isUserManagedProvider(id: string): boolean {
  return id.startsWith('custom-api-') || USER_MANAGED_FIXED_PROVIDERS.has(id);
}

interface ProviderEntry {
  provider: string;
  label: string;
  color: string;
  modelCount: number;
  configuredCount: number;
  hasAuth: boolean;
}

export function ModelsTab() {
  const isMobile = useIsMobile();
  const {
    models, modelsLoading, modelsError, fetchModels,
    catalog, catalogLoading, catalogError, fetchCatalog,
    addModel, removeModel,
  } = useGatewayStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = ((searchParams.get('view') as View) === 'catalog' || (searchParams.get('view') as View) === 'advanced')
    ? (searchParams.get('view') as View)
    : 'configured';
  const [view, setViewState] = useState<View>(initialView);
  const setView = (next: View) => {
    setViewState(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'models');
    if (next === 'configured') params.delete('view');
    else params.set('view', next);
    setSearchParams(params, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [mutatingModel, setMutatingModel] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);
  const [wizardModel, setWizardModel] = useState<CatalogModel | null>(null);
  const [catalogSubView, setCatalogSubView] = useState<CatalogSubView>('providers');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [customWizardType, setCustomWizardType] = useState<import('../components/ModelSetupWizard').ProviderType | null>(null);
  const [customProviderIds, setCustomProviderIds] = useState<string[]>([]);
  const [providersConfig, setProvidersConfig] = useState<gwService.ProvidersConfig | null>(null);
  const [ollamaSettings, setOllamaSettings] = useState<{ modelId: string; modelName?: string; initialParams?: gwService.OllamaTuningParams } | null>(null);
  const [discoveredCounts, setDiscoveredCounts] = useState<Record<string, number>>({});
  const [customModelEditor, setCustomModelEditor] = useState<{
    mode: 'add' | 'edit';
    provider: string;
    modelId: string;
    modelName?: string;
    contextWindow?: number;
    maxTokens?: number;
  } | null>(null);
  const ollamaStatus = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_status ?? 'disconnected');
  const ollamaUrl = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_url ?? 'http://127.0.0.1:11434');

  useEffect(() => {
    if (models.length === 0) fetchModels();
  }, [models.length, fetchModels]);

  useEffect(() => {
    if (view === 'catalog' && catalog.length === 0 && !catalogLoading) fetchCatalog();
  }, [view, catalog.length, catalogLoading, fetchCatalog]);

  // Fetch custom provider IDs and full config (so the grid shows them
  // even with 0 catalog models, and the Edit modal can read existing
  // contextWindow/maxTokens from `models.providers[id].models[]`).
  const fetchCustomProviders = useCallback(async () => {
    try {
      const config = await gwService.getProvidersConfig();
      setProvidersConfig(config);
      setCustomProviderIds(Object.keys(config.providers ?? {}));
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    if (view === 'catalog') fetchCustomProviders();
  }, [view, fetchCustomProviders]);

  // Background discover for custom providers with 0 catalog models (to show count in grid)
  useEffect(() => {
    if (view !== 'catalog' || catalogSubView !== 'providers') return;
    const catalogProviders = new Set(catalog.map(m => m.provider));
    const toDiscover = customProviderIds.filter(id => !catalogProviders.has(id));
    if (toDiscover.length === 0) return;
    let cancelled = false;
    for (const id of toDiscover) {
      gwService.discoverProviderModels(id).then((result) => {
        if (!cancelled) {
          setDiscoveredCounts(prev => ({ ...prev, [id]: result.models.length }));
        }
      }).catch(() => { /* silent */ });
    }
    return () => { cancelled = true; };
  }, [view, catalogSubView, customProviderIds, catalog]);

  const handleSetDefault = async (model: GatewayModel) => {
    setSettingDefault(model.id);
    try {
      await gwService.setDefaultModel(model.id || model.model);
      toast.success(`Default model set to ${model.model}`);
      fetchModels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default model');
    } finally {
      setSettingDefault(null);
    }
  };

  const handleAddModel = async (key: string) => {
    setMutatingModel(key);
    try {
      await addModel(key);
      toast.success(`Added ${key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setMutatingModel(null);
    }
  };

  const handleRemoveModel = async (key: string) => {
    setMutatingModel(key);
    try {
      await removeModel(key);
      toast.success(`Removed ${key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove model');
    } finally {
      setMutatingModel(null);
    }
  };

  // Provider list derived from catalog (kept for backwards compat)
  const providers = useMemo(() => {
    const set = new Set<string>();
    for (const m of catalog) set.add(m.provider);
    return Array.from(set).sort();
  }, [catalog]);

  // Provider entries for the catalog grid (catalog models + custom providers from config)
  const providerEntries = useMemo((): ProviderEntry[] => {
    const grouped = new Map<string, { count: number; available: boolean; configured: number }>();
    for (const m of catalog) {
      const entry = grouped.get(m.provider) ?? { count: 0, available: false, configured: 0 };
      entry.count++;
      if (m.available) entry.available = true;
      if (m.configured) entry.configured++;
      grouped.set(m.provider, entry);
    }
    // Merge custom providers from config that have 0 models in the catalog
    for (const id of customProviderIds) {
      if (!grouped.has(id)) {
        grouped.set(id, { count: discoveredCounts[id] ?? 0, available: true, configured: 0 });
      }
    }
    const entries: ProviderEntry[] = Array.from(grouped.entries()).map(([provider, info]) => {
      // Orphan: user-managed provider whose models are still referenced by
      // agents.list / agents.defaults, so the catalog lists them as
      // available — but `models.providers[id]` is gone, so calls fail with
      // 401 "no api key found". Treat as needing setup so clicking the
      // tile opens the wizard pre-populated.
      const isOrphan = isUserManagedProvider(provider) && !customProviderIds.includes(provider);
      return {
        provider,
        label: PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1),
        color: PROVIDER_COLORS[provider] ?? 'var(--text-dim)',
        modelCount: info.count,
        configuredCount: info.configured,
        hasAuth: info.available && !isOrphan,
      };
    });
    // Providers with auth first, then alphabetical
    entries.sort((a, b) => {
      if (a.hasAuth !== b.hasAuth) return a.hasAuth ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    return entries;
  }, [catalog, customProviderIds, discoveredCounts]);

  const handleProviderClick = (provider: string) => {
    const entry = providerEntries.find(e => e.provider === provider);
    if (!entry?.hasAuth) {
      // No credentials — open wizard for this provider. For orphans, all
      // catalog models are flagged `configured`, so fall back to any model
      // from the provider (the wizard skips re-adding when configured).
      const representative = catalog.find(m => m.provider === provider && !m.configured)
        ?? catalog.find(m => m.provider === provider);
      if (representative) {
        setWizardModel(representative);
      } else if (USER_MANAGED_FIXED_PROVIDERS.has(provider)) {
        setCustomWizardType(provider as import('../components/ModelSetupWizard').ProviderType);
      } else {
        setCustomWizardType('custom');
      }
      setSelectedProvider(provider);
      return;
    }
    // Has credentials — go directly to models
    setSelectedProvider(provider);
    setCatalogSubView('models');
  };

  const handleWizardSuccess = () => {
    fetchModels();
    fetchCatalog();
    fetchCustomProviders();
    if (selectedProvider) {
      setCatalogSubView('models');
    }
  };

  // ── Discover models for custom providers ──
  // Always run for custom providers when viewing their model list, so the
  // user can add additional models even after one is already configured.
  // The render layer dedupes against the configured catalog entries and
  // shows discovered-but-not-configured models as "available to add".
  const [discoveredModels, setDiscoveredModels] = useState<gwService.DiscoveredModel[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  useEffect(() => {
    if (catalogSubView !== 'models' || !selectedProvider) { setDiscoveredModels([]); return; }
    const isCustom = customProviderIds.includes(selectedProvider);
    if (!isCustom) { setDiscoveredModels([]); return; }
    let cancelled = false;
    setDiscovering(true);
    setDiscoverError(null);
    gwService.discoverProviderModels(selectedProvider).then((result) => {
      if (!cancelled) setDiscoveredModels(result.models);
    }).catch((err) => {
      if (!cancelled) setDiscoverError(err instanceof Error ? err.message : 'Failed to discover models');
    }).finally(() => {
      if (!cancelled) setDiscovering(false);
    });
    return () => { cancelled = true; };
  }, [catalogSubView, selectedProvider, customProviderIds]);

  // Adding a discovered model opens the editor modal so the user can set
  // contextWindow + maxTokens explicitly. Without this OpenClaw falls
  // back to DEFAULT_CONTEXT_TOKENS=200000, which is wrong for both small
  // (Llama 8K) and large (DeepSeek 1M) custom models.
  // Add a model from a custom-provider catalog directly, WITHOUT opening the
  // modal. Uses sensible defaults (200K ctx, 8K maxTokens) — the user can fine-
  // tune via Edit afterwards. Decision recorded in plan 2026-05-23: NVIDIA
  // doesn't expose context_length in /v1/models, so we'd be asking the user
  // for info they don't have. One-click Add + Edit-when-needed is simpler.
  const handleAddCustomModelDirect = async (provider: string, modelId: string) => {
    const key = `${provider}/${modelId}`;
    setMutatingModel(key);
    try {
      await gwService.addModelWithConfig({
        model: key,
        provider_id: provider,
        model_id: modelId,
        name: modelId,
        context_window: 200_000,
        max_tokens: 8_192,
      });
      toast.success(`Added ${modelId}`);
      // Refresh catalog + providers so the row immediately flips to
      // "Configured" with Edit/Remove actions.
      fetchModels();
      fetchCatalog();
      fetchCustomProviders();
    } catch (err) {
      // Probe errors (MODEL_NOT_IN_CATALOG / MODEL_NOT_SERVING / etc.) come
      // through with a structured shape from the api client. Surface the full
      // message so the user sees what the provider said.
      const sample = (err as { available_sample?: string[] }).available_sample;
      const msg = err instanceof Error ? err.message : String(err);
      const hint = sample?.length ? ` (ej.: ${sample.slice(0, 3).join(', ')})` : '';
      toast.error(msg + hint);
    } finally {
      setMutatingModel(null);
    }
  };

  // Edit existing custom-managed model: pre-populate the modal with the
  // current contextWindow + maxTokens read from `models.providers[id].models[]`.
  const handleEditCustomModel = (model: CatalogModel) => {
    const providerCfg = providersConfig?.providers?.[model.provider];
    const modelsList = (providerCfg?.models as Array<Record<string, unknown>> | undefined) ?? [];
    const modelId = model.key.startsWith(`${model.provider}/`)
      ? model.key.slice(model.provider.length + 1)
      : model.key;
    const existing = modelsList.find(m => m.id === modelId);
    setCustomModelEditor({
      mode: 'edit',
      provider: model.provider,
      modelId,
      modelName: (existing?.name as string | undefined) ?? model.name ?? modelId,
      contextWindow: typeof existing?.contextWindow === 'number'
        ? existing.contextWindow
        : (model.context_window ?? undefined),
      maxTokens: typeof existing?.maxTokens === 'number' ? existing.maxTokens : undefined,
    });
  };

  const handleCustomModelEditorSuccess = () => {
    fetchModels();
    fetchCatalog();
    fetchCustomProviders();
  };

  // Abre el panel de ajustes Ollama por-modelo. Lee los params actuales de
  // providers.ollama.models[].params (fetch fresco si no está cargado en esta vista).
  const handleEditOllama = async (model: GatewayModel) => {
    const full = model.model || model.id || '';
    const tag = full.startsWith('ollama/') ? full.slice('ollama/'.length) : full;
    let initialParams: gwService.OllamaTuningParams | undefined;
    let name = tag;
    try {
      const cfg = providersConfig ?? (await gwService.getProvidersConfig());
      const list = (cfg?.providers?.ollama?.models as Array<Record<string, unknown>> | undefined) ?? [];
      const existing = list.find((m) => m.id === tag);
      if (existing) {
        initialParams = existing.params as gwService.OllamaTuningParams | undefined;
        name = (existing.name as string | undefined) ?? tag;
      }
    } catch { /* sin params previos → el modal usa defaults */ }
    setOllamaSettings({ modelId: tag, modelName: name, initialParams });
  };

  // ── Delete custom provider ──
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);

  const handleDeleteProvider = async (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove provider "${providerId}"? Models from this provider will be removed.`)) return;
    setDeletingProvider(providerId);
    try {
      await gwService.deleteProvider(providerId);
      toast.success(`Provider "${providerId}" removed`);
      fetchModels();
      fetchCatalog();
      fetchCustomProviders();
      if (selectedProvider === providerId) {
        setCatalogSubView('providers');
        setSelectedProvider(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete provider');
    } finally {
      setDeletingProvider(null);
    }
  };

  // Filtered lists
  const filteredModels = useMemo(() => {
    return models.filter(m => {
      if (!search) return true;
      const q = search.toLowerCase();
      return m.model?.toLowerCase().includes(q) ||
             m.provider?.toLowerCase().includes(q) ||
             m.id?.toLowerCase().includes(q);
    });
  }, [models, search]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(m => {
      if (providerFilter && m.provider !== providerFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return m.key?.toLowerCase().includes(q) ||
             m.name?.toLowerCase().includes(q) ||
             m.provider?.toLowerCase().includes(q);
    });
  }, [catalog, search, providerFilter]);

  const loading = view === 'advanced' ? false : (view === 'configured' ? modelsLoading : catalogLoading);
  const error = view === 'advanced' ? null : (view === 'configured' ? modelsError : catalogError);
  // For custom providers in models view, include available-to-add
  // (discovered but not yet configured) in the count.
  const selectedProviderModelsCount = (() => {
    const configured = filteredCatalog.filter(m => m.provider === selectedProvider).length;
    if (!selectedProvider || !customProviderIds.includes(selectedProvider)) return configured;
    const configuredKeys = new Set(
      catalog.filter(m => m.provider === selectedProvider).map(m => m.key)
    );
    const available = discoveredModels.filter(dm => !configuredKeys.has(`${selectedProvider}/${dm.id}`)).length;
    return configured + available;
  })();
  const count = view === 'advanced' ? 0
    : view === 'configured' ? filteredModels.length
    : catalogSubView === 'providers' ? providerEntries.length
    : selectedProviderModelsCount;
  const countLabel = view === 'catalog' && catalogSubView === 'providers'
    ? `${count} provider${count !== 1 ? 's' : ''}`
    : `${count} model${count !== 1 ? 's' : ''}`;

  if (loading && (view === 'configured' ? models.length === 0 : catalog.length === 0)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {error}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, gap: 12, flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            flex: isMobile ? '1 1 100%' : undefined,
            maxWidth: 280,
          }}>
            <SearchIcon size={14} style={{ color: 'var(--text-dim)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'catalog' && catalogSubView === 'providers' ? 'Search providers...' : 'Search models...'}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                width: '100%',
              }}
            />
          </div>

          {/* View toggle */}
          <ViewToggle view={view} onChange={(v) => { setView(v); setProviderFilter(null); setCatalogSubView('providers'); setSelectedProvider(null); setSearch(''); }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: '0.8125rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}>
              {countLabel}
            </span>
            <button
              onClick={() => view === 'configured' ? fetchModels() : fetchCatalog()}
              onMouseEnter={() => setRefreshHover(true)}
              onMouseLeave={() => setRefreshHover(false)}
              style={{
                background: refreshHover ? 'var(--surface-hover)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                transition: 'var(--transition-fast)',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Content by view */}
        {view === 'advanced' ? (
          <ModelsAdvancedView />
        ) : view === 'configured' ? (
          filteredModels.length === 0 ? (
            <EmptyState text={search ? 'No models match your search' : 'No models configured'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredModels.map((model) => (
                <ConfiguredRow
                  key={model.id || model.model}
                  model={model}
                  isMobile={isMobile}
                  isHovered={hoveredRow === model.id}
                  onHover={setHoveredRow}
                  settingDefault={settingDefault}
                  onSetDefault={handleSetDefault}
                  mutatingModel={mutatingModel}
                  onRemove={handleRemoveModel}
                  onEditOllama={handleEditOllama}
                />
              ))}
            </div>
          )
        ) : catalogSubView === 'providers' ? (
          /* ── Catalog: Provider Grid (Step 1) ── */
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '160px' : '220px'}, 1fr))`,
              gap: 10,
            }}>
              {providerEntries
                .filter(e => !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.provider.toLowerCase().includes(search.toLowerCase()))
                .map((entry) => (
                  <ProviderCard
                    key={entry.provider}
                    entry={entry}
                    onClick={() => handleProviderClick(entry.provider)}
                    onDelete={customProviderIds.includes(entry.provider) ? (e) => handleDeleteProvider(entry.provider, e) : undefined}
                    deleting={deletingProvider === entry.provider}
                  />
                ))}

              {/* Ollama (if not in catalog because disconnected) */}
              {!providerEntries.some(e => e.provider === 'ollama') && (
                <ProviderCard
                  entry={{
                    provider: 'ollama',
                    label: 'Ollama',
                    color: PROVIDER_COLORS.ollama ?? '#888',
                    modelCount: 0,
                    configuredCount: 0,
                    hasAuth: false,
                  }}
                  subtitle={ollamaStatus === 'connected' ? 'No models pulled yet' : `Disconnected · ${ollamaUrl}`}
                  onClick={() => { setView('advanced'); }}
                />
              )}

              {/* Custom provider types (aligned with OpenClaw CLI) */}
              <AddProviderTypeCard
                label="Custom Provider"
                description="Any OpenAI or Anthropic-compatible endpoint"
                onClick={() => setCustomWizardType('custom')}
                provider="custom"
              />
              <AddProviderTypeCard
                label="Ollama"
                description="Local or cloud Ollama instance"
                onClick={() => setCustomWizardType('ollama')}
                provider="ollama"
              />
              <AddProviderTypeCard
                label="SGLang"
                description="Fast self-hosted server"
                onClick={() => setCustomWizardType('sglang')}
                provider="sglang"
              />
              <AddProviderTypeCard
                label="vLLM"
                description="Local/self-hosted OpenAI-compatible"
                onClick={() => setCustomWizardType('vllm')}
                provider="vllm"
              />
              <AddProviderTypeCard
                label="LM Studio"
                description="Local LM Studio server"
                onClick={() => setCustomWizardType('lm-studio')}
                provider="lm-studio"
              />

              {/* U10: cloud-provider quickstarts. Each card opens the wizard
                  pre-filled with the provider id; the binary already knows
                  the baseUrl natively, so the user only needs an API key. */}
              <AddProviderTypeCard
                label="xAI"
                description="Grok models (Grok 4, Grok Code) — sign in with X or paste an API key"
                onClick={() => setCustomWizardType('xai')}
                provider="xai"
              />
              <AddProviderTypeCard
                label="OpenRouter"
                description="One key, hundreds of models from many providers"
                onClick={() => setCustomWizardType('openrouter')}
                provider="openrouter"
              />
              <AddProviderTypeCard
                label="MiniMax"
                description="M2 series + the only mainstream Music streaming provider"
                onClick={() => setCustomWizardType('minimax')}
                provider="minimax"
              />
              <AddProviderTypeCard
                label="Cohere"
                description="Command R+ family + multilingual embeddings"
                onClick={() => setCustomWizardType('cohere')}
                provider="cohere"
              />
              <AddProviderTypeCard
                label="Fal"
                description="Image and video generation (Krea, Flux, SDXL)"
                onClick={() => setCustomWizardType('fal')}
                provider="fal"
              />
              <AddProviderTypeCard
                label="Arcee"
                description="Small/medium specialised models (Trinity, Coder, Spark)"
                onClick={() => setCustomWizardType('arcee')}
                provider="arcee"
              />
            </div>

            {/* ── Modelos locales (Ollama) — sub-sección separada al final.
                 Solo relevante si usas Ollama/LM Studio local; va abajo para no
                 tapar el catálogo de proveedores. ── */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={14} /> Modelos locales (Ollama)
              </div>
              <GpuCoordinationPanel />
              <AddModelPanel onAdded={fetchCatalog} />
            </div>
          </>
        ) : (
          /* ── Catalog: Provider Models (Step 2) ── */
          <>
            {/* Back + provider header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button
                onClick={() => { setCatalogSubView('providers'); setSelectedProvider(null); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                  color: 'var(--text-dim)', fontSize: '0.75rem',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <ArrowLeft size={12} /> All providers
              </button>
              {selectedProvider && (() => {
                const entry = providerEntries.find(e => e.provider === selectedProvider);
                const color = PROVIDER_COLORS[selectedProvider] ?? 'var(--text-dim)';
                const ProviderIcon = getProviderIcon(selectedProvider);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                      background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {ProviderIcon
                        ? <ProviderIcon size={18} style={{ color }} />
                        : <Cpu size={12} style={{ color }} />}
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                      {PROVIDER_LABELS[selectedProvider] ?? selectedProvider}
                    </span>
                    {entry?.hasAuth
                      ? <StatusPill status="available" />
                      : <StatusPill status="no_auth" />
                    }
                  </div>
                );
              })()}
            </div>

            {/* Model list for selected provider */}
            {(() => {
              const providerModels = filteredCatalog.filter(m => m.provider === selectedProvider);
              const isCustom = customProviderIds.includes(selectedProvider!);
              const q = search.toLowerCase();

              // For custom providers, surface available-to-add models
              // (discovered from the provider's /models endpoint) that
              // aren't already in the configured catalog.
              const configuredKeys = new Set(
                catalog.filter(m => m.provider === selectedProvider).map(m => m.key)
              );
              const availableToAdd = isCustom
                ? discoveredModels.filter(dm => !configuredKeys.has(`${selectedProvider}/${dm.id}`))
                : [];
              const filteredAvailable = search
                ? availableToAdd.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
                : availableToAdd;

              const showLoading = isCustom && discovering && providerModels.length === 0 && discoveredModels.length === 0;
              const showError = isCustom && discoverError && providerModels.length === 0 && discoveredModels.length === 0;
              const showEmpty = providerModels.length === 0 && filteredAvailable.length === 0 && !showLoading && !showError;

              if (showLoading) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    <Loader2 size={14} className="spin" /> Discovering models from {selectedProvider}...
                  </div>
                );
              }
              if (showError) {
                return (
                  <div style={{
                    padding: 20, background: '#ef444410', border: '1px solid #ef444425',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <p style={{ color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 4 }}>
                      Could not connect to this provider
                    </p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: 8 }}>{discoverError}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', lineHeight: 1.4 }}>
                      Check that the server is running and the Base URL is correct. You can delete this provider and recreate it with the right URL.
                    </p>
                  </div>
                );
              }
              if (showEmpty) {
                const text = search
                  ? 'No models match your search'
                  : isCustom && !discovering
                    ? 'No models available. If this is LM Studio, make sure at least one model is loaded.'
                    : 'No models available for this provider';
                return <EmptyState text={text} />;
              }

              // ── Unified list ────────────────────────────────────────
              // The user complained about the two visually separated lists
              // ("Configured" then "Available to add") feeling redundant with
              // the dedicated "Configured" tab. We now show ONE continuous list
              // of the provider's full catalog — configured models on top
              // (preserved relevance), each row carrying its own state badge
              // ("Configured" green pill) and the right action button (Edit/
              // Remove vs Add).
              //
              // `discoveredAsCatalog` adapts the discovered shape into the
              // CatalogModel-shape that CatalogRow already consumes, so we
              // don't duplicate render code. `available: true` because if the
              // provider exposes the model via /v1/models we have auth (or
              // it's a public catalog like OpenRouter).
              const discoveredAsCatalog: CatalogModel[] = filteredAvailable.map((dm) => ({
                key: `${selectedProvider}/${dm.id}`,
                name: dm.name || dm.id,
                provider: selectedProvider!,
                context_window: null,
                input_type: 'text',
                available: true,
                configured: false,
                is_default: false,
                local: false,
              }));
              const unifiedList: CatalogModel[] = [...providerModels, ...discoveredAsCatalog];

              // Count "added" from the source-of-truth `configured` flag, not
              // from `providerModels.length`. The catalog can list entries that
              // exist in `models.providers.<id>.models` (provider entry) but
              // aren't yet in `agents.defaults.models` (the allow-list that
              // marks `configured: true`). Counting by flag avoids misleading
              // numbers in that edge case.
              const addedCount = unifiedList.filter((m) => m.configured).length;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Single header with counts */}
                  {unifiedList.length > 0 && (
                    <div style={{
                      marginBottom: 4,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600,
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-display)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {unifiedList.length} model{unifiedList.length !== 1 ? 's' : ''}
                      </span>
                      {addedCount > 0 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          · {addedCount} added
                        </span>
                      )}
                      {discovering && <Loader2 size={11} className="spin" style={{ color: 'var(--text-dim)' }} />}
                    </div>
                  )}
                  {unifiedList.map((model) => (
                    <CatalogRow
                      key={model.key}
                      model={model}
                      isMobile={isMobile}
                      isHovered={hoveredRow === model.key}
                      onHover={setHoveredRow}
                      mutatingModel={mutatingModel}
                      // Dispatch del Add según el tipo de provider:
                      //   - Custom (en `models.providers.<id>`: nvidia, ollama,
                      //     custom-api-*, lm-studio, etc.) → llama directamente
                      //     a addModelWithConfig con defaults 200K/8K (sin modal).
                      //     El usuario ajusta luego con Edit si los defaults no
                      //     encajan. Razón: NVIDIA y otros no exponen
                      //     context_length en /v1/models, así que el modal
                      //     pedía info que el usuario no tiene a mano.
                      //   - Built-in puro (openrouter, anthropic, openai sin
                      //     entry custom) → addModel directo, sin metadata
                      //     (el binario openclaw sabe sus ctx nativamente).
                      onAdd={(key) => {
                        if (!model.configured && customProviderIds.includes(model.provider)) {
                          const slash = key.indexOf('/');
                          const modelId = slash >= 0 ? key.slice(slash + 1) : key;
                          void handleAddCustomModelDirect(model.provider, modelId);
                        } else {
                          handleAddModel(key);
                        }
                      }}
                      onRemove={handleRemoveModel}
                      onConfigure={(m) => setWizardModel(m)}
                      onEdit={isUserManagedProvider(model.provider) && model.configured
                        ? handleEditCustomModel
                        : undefined}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>
      {wizardModel && (
        <ModelSetupWizard
          model={wizardModel}
          providerModels={catalog.filter(m => m.provider === wizardModel.provider)}
          onClose={() => setWizardModel(null)}
          onSuccess={handleWizardSuccess}
        />
      )}
      {customWizardType && (
        <ModelSetupWizard
          model={null}
          providerType={customWizardType}
          providerModels={catalog.filter(m => m.provider === customWizardType)}
          onClose={() => setCustomWizardType(null)}
          onSuccess={handleWizardSuccess}
        />
      )}
      {customModelEditor && (
        <CustomModelConfigModal
          mode={customModelEditor.mode}
          provider={customModelEditor.provider}
          modelId={customModelEditor.modelId}
          modelName={customModelEditor.modelName}
          initialContextWindow={customModelEditor.contextWindow}
          initialMaxTokens={customModelEditor.maxTokens}
          onClose={() => setCustomModelEditor(null)}
          onSuccess={handleCustomModelEditorSuccess}
        />
      )}
      {ollamaSettings && (
        <OllamaModelSettingsModal
          modelId={ollamaSettings.modelId}
          modelName={ollamaSettings.modelName}
          initialParams={ollamaSettings.initialParams}
          onClose={() => setOllamaSettings(null)}
          onSuccess={() => { fetchModels(); fetchCustomProviders(); }}
        />
      )}
    </ScrollArea>
  );
}

// ─── Empty State ───────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 60, gap: 12,
    }}>
      <Cpu size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
      <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>{text}</span>
    </div>
  );
}

// ─── Provider Card (Catalog grid) ──────────────────────────────────

function ProviderCard({ entry, subtitle, onClick, onDelete, deleting }: {
  entry: ProviderEntry;
  subtitle?: string;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  deleting?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ProviderIcon = getProviderIcon(entry.provider);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${entry.hasAuth ? entry.color + '30' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: `${entry.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {ProviderIcon
            ? <ProviderIcon size={24} style={{ color: entry.color }} />
            : <Cpu size={14} style={{ color: entry.color }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {entry.label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1 }}>
            {subtitle ?? `${entry.modelCount} model${entry.modelCount !== 1 ? 's' : ''}${entry.configuredCount > 0 ? ` · ${entry.configuredCount} configured` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {entry.hasAuth ? (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            }} />
          ) : (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5, flexShrink: 0,
            }} />
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                background: 'transparent', border: 'none', cursor: deleting ? 'wait' : 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: deleting ? 0.5 : 1,
              }}
              title="Remove provider"
            >
              {deleting ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
            </button>
          )}
          <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
        </div>
      </div>
    </button>
  );
}

function AddProviderTypeCard({ label, description, onClick, provider }: {
  label: string;
  description: string;
  onClick: () => void;
  provider: string;
}) {
  const [hovered, setHovered] = useState(false);
  const ProviderIcon = getProviderIcon(provider);
  const color = PROVIDER_COLORS[provider?.toLowerCase()] ?? 'var(--text-dim)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: ProviderIcon ? `${color}15` : 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {ProviderIcon
            ? <ProviderIcon size={24} style={{ color }} />
            : <Cpu size={14} style={{ color: 'var(--text-dim)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1, lineHeight: 1.3 }}>
            {description}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
      </div>
    </button>
  );
}

// `DiscoveredModelRow` removed (2026-05-23): the catalog tab now uses a single
// unified list backed by CatalogRow, which adapts discovered models via a
// `discoveredAsCatalog` shape (see the render block above). Add-action flow
// still distinguishes built-in vs user-managed providers internally.

// ─── View Toggle ────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {(['configured', 'catalog', 'advanced'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '5px 14px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            background: view === v ? 'var(--surface-hover)' : 'transparent',
            color: view === v ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {v === 'configured' ? 'Configured' : v === 'catalog' ? 'Catalog' : 'Advanced'}
        </button>
      ))}
    </div>
  );
}

// ─── Provider Chip ──────────────────────────────────────────────────

function ProviderChip({ label, color, active, onClick }: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? (color ?? 'var(--text-dim)') + '60' : 'var(--border)'}`,
        background: active ? (color ?? 'var(--text-dim)') + '15' : hovered ? 'var(--surface-hover)' : 'transparent',
        color: active ? (color ?? 'var(--text)') : 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        whiteSpace: 'nowrap',
        textTransform: 'capitalize',
      }}
    >
      {color && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
      )}
      {label}
    </button>
  );
}

// ─── Configured Row ─────────────────────────────────────────────────

function ConfiguredRow({ model, isMobile, isHovered, onHover, settingDefault, onSetDefault, mutatingModel, onRemove, onEditOllama }: {
  model: GatewayModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  settingDefault: string | null;
  onSetDefault: (m: GatewayModel) => void;
  mutatingModel: string | null;
  onRemove: (key: string) => void;
  onEditOllama?: (m: GatewayModel) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);

  return (
    <div
      onMouseEnter={() => onHover(model.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${model.is_default ? 'var(--amber)40' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        flexWrap: isMobile ? 'wrap' : undefined,
      }}
    >
      {/* Provider icon */}
      <div style={{
        width: 34, height: 34,
        borderRadius: 'var(--radius-sm)',
        background: `${providerColor}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {ProviderIcon
          ? <ProviderIcon size={26} style={{ color: providerColor }} />
          : <Cpu size={16} style={{ color: providerColor }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {model.model || model.id}
          </span>
          {model.is_default && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'var(--amber-dim)', color: 'var(--amber)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Star size={9} /> DEFAULT
            </span>
          )}
          {model.is_image && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#8b5cf620', color: '#8b5cf6',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Image size={9} /> IMAGE
            </span>
          )}
          {model.status && <StatusPill status={model.status} />}
          {model.orphan && (
            <span title="Provider no existe en openclaw.json. Esta entrada es basura residual: b\u00f3rrala o configura el provider." style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#ef444420', color: '#ef4444',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              \u26a0 ORPHAN
            </span>
          )}
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', marginTop: 2,
          textTransform: 'capitalize',
        }}>
          {model.provider}
          {model.is_fallback && ' \u00b7 fallback'}
          {model.orphan && ' \u00b7 provider eliminado'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {model.provider === 'ollama' && onEditOllama && (
          <ActionButton
            icon={<SlidersHorizontal size={12} />}
            label="Editar"
            onClick={() => onEditOllama(model)}
          />
        )}
        {!model.is_default && (
          <SetDefaultButton
            onClick={() => onSetDefault(model)}
            loading={settingDefault === model.id}
          />
        )}
        <ActionButton
          icon={<X size={12} />}
          label="Remove"
          loading={mutatingModel === model.id}
          onClick={() => onRemove(model.id)}
          variant="danger"
        />
      </div>
    </div>
  );
}

// ─── Catalog Row ────────────────────────────────────────────────────

function formatCtx(ctx: number | null): string {
  if (!ctx) return '';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 === 0 ? 0 : 1)}M ctx`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K ctx`;
  return `${ctx} ctx`;
}

function CatalogRow({ model, isMobile, isHovered, onHover, mutatingModel, onAdd, onRemove, onConfigure, onEdit }: {
  model: CatalogModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  mutatingModel: string | null;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onConfigure: (model: CatalogModel) => void;
  /** Set for user-managed (custom-api-*, ollama, vllm, sglang, lm-studio)
   *  configured models — opens the modal to edit contextWindow / maxTokens. */
  onEdit?: (model: CatalogModel) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);
  const isMutating = mutatingModel === model.key;

  return (
    <div
      onMouseEnter={() => onHover(model.key)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${model.configured ? '#10b98130' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        flexWrap: isMobile ? 'wrap' : undefined,
      }}
    >
      {/* Provider icon */}
      <div style={{
        width: 34, height: 34,
        borderRadius: 'var(--radius-sm)',
        background: `${providerColor}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {ProviderIcon
          ? <ProviderIcon size={26} style={{ color: providerColor }} />
          : <Cpu size={16} style={{ color: providerColor }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.8125rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {model.name || model.key}
          </span>
          {model.context_window && (
            <span style={{
              fontSize: '0.625rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {formatCtx(model.context_window)}
            </span>
          )}
          {model.configured && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#10b98120', color: '#10b981',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Check size={9} /> Configured
            </span>
          )}
          {model.is_default && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'var(--amber-dim)', color: 'var(--amber)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Star size={9} /> DEFAULT
            </span>
          )}
          {model.available
            ? <StatusPill status="available" />
            : <StatusPill status="no_auth" />
          }
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', marginTop: 2,
        }}>
          <span style={{ textTransform: 'capitalize' }}>{model.provider}</span>
          {model.input_type && model.input_type !== 'text' && (
            <span> &middot; {model.input_type}</span>
          )}
          {model.local && <span> &middot; local</span>}
        </div>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Edit ctx/maxTokens — only for configured user-managed providers */}
        {onEdit && model.configured && (
          <ActionButton
            icon={<Pencil size={12} />}
            label="Edit"
            loading={false}
            onClick={() => onEdit(model)}
            variant="secondary"
          />
        )}
        {!model.is_default && (
          model.configured ? (
            <ActionButton
              icon={<X size={12} />}
              label="Remove"
              loading={isMutating}
              onClick={() => onRemove(model.key)}
              variant="danger"
            />
          ) : model.available ? (
            <ActionButton
              icon={<Plus size={12} />}
              label="Add"
              loading={isMutating}
              onClick={() => onAdd(model.key)}
              variant="primary"
            />
          ) : (
            // Provider has no credentials yet — open the wizard so the user
            // can paste an API key (standard providers) or set up a custom
            // base URL + key (custom-api-* providers). After success the
            // wizard adds the model automatically.
            <ActionButton
              icon={<Key size={12} />}
              label="Configure provider"
              loading={isMutating}
              onClick={() => onConfigure(model)}
              variant="secondary"
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── Shared Buttons ─────────────────────────────────────────────────

function SetDefaultButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--amber-dim)' : 'transparent',
        color: hovered ? 'var(--amber)' : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Star size={12} />
      {loading ? '...' : 'Set Default'}
    </button>
  );
}

function ActionButton({ icon, label, loading, onClick, variant }: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  variant: 'primary' | 'danger' | 'secondary';
}) {
  const [hovered, setHovered] = useState(false);
  const colors = variant === 'primary'
    ? { bg: '#10b98120', color: '#10b981' }
    : variant === 'danger'
      ? { bg: '#ef444420', color: '#ef4444' }
      : { bg: 'var(--amber-dim)', color: 'var(--amber)' };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.bg : 'transparent',
        color: hovered ? colors.color : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {icon}
      {loading ? '...' : label}
    </button>
  );
}

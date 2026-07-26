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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { listManagedAgents } from '@/services/agents-admin.service';
import type { ManagedAgent } from '@/modules/agents/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModelSetupWizard, providerTypeForId, type ProviderType } from '../components/ModelSetupWizard';
import { ModelsAdvancedView } from '../components/ModelsAdvancedView';
import { CustomModelConfigModal } from '../components/CustomModelConfigModal';
import { OllamaModelSettingsModal } from '../components/OllamaModelSettingsModal';
import { AddOllamaModelModal } from '../components/AddOllamaModelModal';
import type { GatewayModel, CatalogModel, ProviderOverview } from '../types';
import { PROVIDER_COLORS, PROVIDER_LABELS } from './models/constants';
import type { View, CatalogSubView, ProviderEntry } from './models/types';
import { useModelMutations } from './models/useModelMutations';
import { ModelsHeader } from './models/ModelsHeader';
import { ConfiguredRow } from './models/ConfiguredRow';
import { CatalogProvidersGrid } from './models/CatalogProvidersGrid';
import { ProviderModelsView } from './models/ProviderModelsView';

export function ModelsTab() {
  const isMobile = useIsMobile();
  const {
    models, modelsLoading, modelsError, fetchModels,
    catalog, catalogLoading, catalogError, fetchCatalog,
    providersOverview, providersOverviewLoading, providersOverviewError,
    catalogWarm, fetchProvidersOverview,
    modelTests, testingModels, runModelTest, hydrateModelTests,
    addModel, removeModel,
    queuedRemovals, inflightRemovals, queueRemoveModel, undoRemoveModel,
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [wizardModel, setWizardModel] = useState<CatalogModel | null>(null);
  const [catalogSubView, setCatalogSubView] = useState<CatalogSubView>('providers');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [customWizardType, setCustomWizardType] = useState<ProviderType | null>(null);
  const [customProviderIds, setCustomProviderIds] = useState<string[]>([]);
  const [providersConfig, setProvidersConfig] = useState<gwService.ProvidersConfig | null>(null);
  const [ollamaSettings, setOllamaSettings] = useState<{ modelId: string; modelName?: string; initialParams?: gwService.OllamaTuningParams } | null>(null);
  const [addModelOpen, setAddModelOpen] = useState(false);          // modal "Añadir modelo local (Ollama)"
  const [discoveredCounts, setDiscoveredCounts] = useState<Record<string, number>>({});
  const [customModelEditor, setCustomModelEditor] = useState<{
    mode: 'add' | 'edit';
    provider: string;
    modelId: string;
    modelName?: string;
    contextWindow?: number;
    maxTokens?: number;
  } | null>(null);

  useEffect(() => {
    if (models.length === 0) fetchModels();
  }, [models.length, fetchModels]);

  // ── Agentes del usuario (avatares por tarjeta + popover "Asignar") ──
  // Join client-side con GET /managed-agents (precedente: HeartbeatTab). Es
  // enriquecimiento: si falla, la pestaña funciona igual sin avatares.
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const refetchAgents = useCallback(async () => {
    try {
      setAgents(await listManagedAgents() as unknown as ManagedAgent[]);
    } catch { /* enriquecimiento, no bloquea el tab */ }
  }, []);
  useEffect(() => { void refetchAgents(); }, [refetchAgents]);

  // Refresco en vivo: cualquier cambio de modelo (desde el módulo Agents o
  // desde el propio botón Asignar) emite agent.model_changed por WS.
  const modelChangedEvent = useWebSocket('agent.model_changed');
  useEffect(() => {
    if (modelChangedEvent) void refetchAgents();
  }, [modelChangedEvent, refetchAgents]);

  // Índice modelo→agentes. agent.model es SIEMPRE fully-qualified
  // ('provider/modelId'); GatewayModel.id también — el doble lookup de abajo
  // (id y provider/model) cubre el caso Ollama sin prefijo en model.model.
  const agentsByModel = useMemo(() => {
    const m = new Map<string, ManagedAgent[]>();
    for (const a of agents) {
      if (!a.model) continue;
      const arr = m.get(a.model) ?? [];
      arr.push(a);
      m.set(a.model, arr);
    }
    return m;
  }, [agents]);

  // SSOT de auth: el providers-overview se carga al montar el TAB entero (no
  // solo en view=catalog) para que Catalog/Configured/Advanced deriven de la
  // misma verdad desde el primer render. Con él se rehidratan también los
  // resultados de tests de salud (viven en Core hasta reinicio) tras un F5.
  useEffect(() => {
    fetchProvidersOverview();
    hydrateModelTests();
    // Solo al montar — las mutaciones encadenan su propio refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el overview se obtuvo con el catálogo FRÍO (featured_count null y
  // universo sin los providers solo-destacados), re-pedirlo UNA vez cuando el
  // catálogo del dash ya cargó (ese fetch calienta la caché de Core).
  const overviewRewarmedRef = useRef(false);
  useEffect(() => {
    if (overviewRewarmedRef.current) return;
    if (catalog.length > 0 && providersOverview !== null && !catalogWarm && !providersOverviewLoading) {
      overviewRewarmedRef.current = true;
      fetchProvidersOverview();
    }
  }, [catalog.length, providersOverview, catalogWarm, providersOverviewLoading, fetchProvidersOverview]);

  useEffect(() => {
    // El catalog se cruza con los modelos configurados para mostrar sus tags de
    // contexto/tamaño en la pestaña Configured → cargarlo también ahí.
    if ((view === 'catalog' || view === 'configured') && catalog.length === 0 && !catalogLoading) fetchCatalog();
  }, [view, catalog.length, catalogLoading, fetchCatalog]);

  // Índice del catalog por key, para enriquecer las filas Configured (que sólo
  // traen id/provider/model/status) con context_window y size_bytes.
  const catalogByKey = useMemo(() => {
    const m = new Map<string, CatalogModel>();
    for (const c of catalog) m.set(c.key, c);
    return m;
  }, [catalog]);

  // Fetch custom provider IDs and full config (so the grid shows them
  // even with 0 catalog models, and the Edit modal can read existing
  // contextWindow/maxTokens from `models.providers[id].models[]`).
  // NOTA: este fetch alimenta providersConfig (editor de modelos custom,
  // params Ollama) y customProviderIds (discover/delete). La AUTH ya no sale
  // de aquí — la sirve el providers-overview del store, cuyo error es visible
  // (banner + Retry), nunca un catch{} silencioso que pintaba "todo sin auth".
  const fetchCustomProviders = useCallback(async () => {
    try {
      const config = await gwService.getProvidersConfig();
      setProvidersConfig(config);
      setCustomProviderIds(Object.keys(config.providers ?? {}));
    } catch { /* solo afecta a metadatos de edición; la auth viene del overview */ }
  }, []);
  useEffect(() => {
    if (view === 'catalog') fetchCustomProviders();
  }, [view, fetchCustomProviders]);

  // Índice del overview por provider id — la señal de auth de todo el tab.
  const overviewById = useMemo(() => {
    const m = new Map<string, ProviderOverview>();
    for (const p of providersOverview ?? []) m.set(p.id, p);
    return m;
  }, [providersOverview]);

  // Abre el formulario de credencial correcto para un provider (paste-key
  // cloud, servidor local fijo o custom). Lo usan el click en tarjeta sin
  // credencial y el 409 PROVIDER_NOT_AUTHENTICATED de las mutaciones.
  const openCredentialWizard = useCallback((provider: string) => {
    // Con un modelo representativo del catálogo, el wizard estándar añade el
    // modelo tras guardar la key; sin modelos (catálogo frío o provider vacío)
    // se abre el formulario del tipo correcto (nvidia/google/… o custom).
    const representative = catalog.find(m => m.provider === provider && !m.configured)
      ?? catalog.find(m => m.provider === provider);
    if (representative) {
      setWizardModel(representative);
    } else {
      setCustomWizardType(providerTypeForId(provider));
    }
    setSelectedProvider(provider);
  }, [catalog]);

  const {
    mutatingModel, addingKey, addProgress, assigning,
    handleAssignAgent, handleAddModel, handleRemoveModel,
    handleDeleteFromDisk, handleAddCustomModelDirect,
  } = useModelMutations({
    addModel, removeModel, queueRemoveModel, fetchModels, fetchCatalog, fetchCustomProviders,
    onNeedsCredential: openCredentialWizard,
    onAgentsChanged: refetchAgents,
  });

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

  // Provider entries for the catalog grid. Counts salen del catálogo (y del
  // discover para customs vacíos); la AUTH sale EXCLUSIVAMENTE del overview
  // (`has_credential`). El flag `available` del catálogo NO es auth — marca
  // modelos destacados aunque no haya key (por eso anthropic/nvidia/google-
  // vertex salían verdes y dejaban añadir modelos que quedaban orphan).
  const providerEntries = useMemo((): ProviderEntry[] => {
    const grouped = new Map<string, { count: number; configured: number }>();
    for (const m of catalog) {
      const entry = grouped.get(m.provider) ?? { count: 0, configured: 0 };
      entry.count++;
      if (m.configured) entry.configured++;
      grouped.set(m.provider, entry);
    }
    // Providers del overview sin modelos en el catálogo (cloud recién dado de
    // alta, custom vacío, mirror declarado…): tarjeta igualmente, con el count
    // del discover (customs) o el featured_count del overview como fallback.
    for (const p of providersOverview ?? []) {
      if (!grouped.has(p.id)) {
        grouped.set(p.id, {
          count: discoveredCounts[p.id] ?? p.featured_count ?? 0,
          configured: p.configured_count,
        });
      }
    }
    const entries: ProviderEntry[] = Array.from(grouped.entries()).map(([provider, info]) => ({
      provider,
      label: PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1),
      color: PROVIDER_COLORS[provider] ?? 'var(--text-dim)',
      modelCount: info.count,
      configuredCount: info.configured,
      // LA señal de auth: overview.has_credential. Sin fila en el overview
      // (p.ej. provider solo-destacado con catálogo frío) = sin credencial.
      hasAuth: overviewById.get(provider)?.has_credential ?? false,
    }));
    // Providers with auth first, then alphabetical
    entries.sort((a, b) => {
      if (a.hasAuth !== b.hasAuth) return a.hasAuth ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    return entries;
  }, [catalog, providersOverview, overviewById, discoveredCounts]);

  // Dedup de tarjetas "Add provider" del grid: presente = entrada en config o
  // credencial activa (contrato del overview).
  const presentProviders = useMemo(() => {
    const s = new Set<string>();
    for (const p of providersOverview ?? []) {
      if (p.entry_in_config || p.has_credential) s.add(p.id);
    }
    return s;
  }, [providersOverview]);

  const handleProviderClick = (provider: string) => {
    if (!overviewById.get(provider)?.has_credential) {
      // Sin credencial — re-pedir la key con el formulario correcto del
      // provider (nvidia/google/groq/… su paste-key; ollama/vllm su form
      // fijo; desconocidos/custom-api-* el Custom). Nunca entrar a modelos.
      openCredentialWizard(provider);
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
    fetchProvidersOverview();
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
  const openOllamaSettings = async (tagOrFull: string) => {
    const tag = tagOrFull.replace(/^ollama\//, '');
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
  // Wrapper para ConfiguredRow (recibe GatewayModel); el Catalog llama directo con el key.
  const handleEditOllama = (model: GatewayModel) => openOllamaSettings(model.model || model.id || '');

  // ── Delete custom provider ──
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  // Confirmación canónica (ConfirmDialog), no window.confirm.
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState<string | null>(null);

  const handleDeleteProvider = (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteProvider(providerId);
  };

  const doDeleteProvider = async () => {
    const providerId = confirmDeleteProvider;
    if (!providerId) return;
    setDeletingProvider(providerId);
    try {
      await gwService.deleteProvider(providerId);
      toast.success(`Provider "${providerId}" removed`);
      fetchModels();
      fetchCatalog();
      fetchCustomProviders();
      fetchProvidersOverview();
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
      <div style={{ padding: isMobile ? 12 : 20 }}>
        <ModelsHeader
          isMobile={isMobile}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={view === 'catalog' && catalogSubView === 'providers' ? 'Search providers...' : 'Search models...'}
          view={view}
          onViewChange={(v) => { setView(v); setProviderFilter(null); setCatalogSubView('providers'); setSelectedProvider(null); setSearch(''); }}
          countLabel={countLabel}
          onRefresh={() => view === 'configured' ? fetchModels() : fetchCatalog()}
        />

        {/* Content by view */}
        {view === 'advanced' ? (
          <ModelsAdvancedView />
        ) : view === 'configured' ? (
          filteredModels.length === 0 ? (
            <EmptyState icon={Cpu} title={search ? 'No models match your search' : 'No models configured'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredModels
                // En vuelo (batch POST) → oculta; si el batch falla, reaparece
                // sola (esto es solo un filtro de render sobre el store).
                .filter((model) => !inflightRemovals.includes(model.id))
                .map((model) => {
                // GatewayModel.model viene SIN prefijo de provider para Ollama
                // ("qwen3:8b"), pero el catalog usa key con prefijo ("ollama/qwen3:8b").
                // Probar ambas formas para cruzar contexto/tamaño en todos los casos.
                const cat = catalogByKey.get(model.model)
                  ?? catalogByKey.get(`${model.provider}/${model.model}`);
                // Key compartida con el Catalog y con el store de tests:
                // 'provider/modelId' (== model.id en el contrato actual).
                const testKey = model.id || `${model.provider}/${model.model}`;
                const assignedAgents = agentsByModel.get(model.id)
                  ?? agentsByModel.get(`${model.provider}/${model.model}`)
                  ?? [];
                return (
                <ConfiguredRow
                  key={model.id || model.model}
                  model={model}
                  isMobile={isMobile}
                  isHovered={hoveredRow === model.id}
                  onHover={setHoveredRow}
                  agents={agents}
                  assignedAgents={assignedAgents}
                  assigning={assigning}
                  onAssignAgent={handleAssignAgent}
                  removalQueued={queuedRemovals.includes(model.id)}
                  onUndoRemove={undoRemoveModel}
                  onRemove={handleRemoveModel}
                  onEditOllama={handleEditOllama}
                  contextWindow={cat?.context_window ?? null}
                  sizeBytes={cat?.size_bytes ?? null}
                  maxContext={cat?.max_context ?? null}
                  caps={cat?.caps ?? null}
                  knowledge={cat?.knowledge ?? null}
                  aaSlug={cat?.aa_slug ?? null}
                  testResult={modelTests[testKey] ?? null}
                  isTesting={testingModels.includes(testKey)}
                  onTest={(key) => { void runModelTest(key); }}
                />
                );
              })}
            </div>
          )
        ) : providersOverviewError ? (
          /* ── Catalog: el overview de providers FALLÓ ──
             Sin él no hay señal de auth fiable: pintar el grid supondría
             "todo sin credencial" (el bug histórico de los catch{} silencios).
             Error visible + Retry, nunca degradar en silencio. */
          <div style={{
            padding: 20, background: '#ef444410', border: '1px solid #ef444425',
            borderRadius: 'var(--radius-md)',
          }}>
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 4 }}>
              Could not load provider credentials overview
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: 10 }}>{providersOverviewError}</p>
            <button
              onClick={() => { void fetchProvidersOverview(); }}
              disabled={providersOverviewLoading}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
                opacity: providersOverviewLoading ? 0.6 : 1,
              }}
            >
              {providersOverviewLoading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        ) : providersOverview === null ? (
          /* Primer fetch del overview en vuelo: no pintar gates erróneos. */
          <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            Loading providers…
          </div>
        ) : catalogSubView === 'providers' ? (
          /* ── Catalog: Provider Grid (Step 1) ── */
          <CatalogProvidersGrid
            entries={providerEntries}
            presentProviders={presentProviders}
            search={search}
            isMobile={isMobile}
            customProviderIds={customProviderIds}
            deletingProvider={deletingProvider}
            onProviderClick={handleProviderClick}
            onDeleteProvider={handleDeleteProvider}
            onSelectProviderType={(type) => {
              setCustomWizardType(type);
              // Para un provider conocido (no 'custom', cuyo id se acuña al
              // crearlo), fijar selectedProvider para que tras Save el flujo
              // navegue a sus modelos (handleWizardSuccess) en vez de dejar al
              // usuario en el grid sin señal de qué pasó.
              if (type !== 'custom') setSelectedProvider(type);
            }}
            onOpenAdvanced={() => { setView('advanced'); }}
          />
        ) : (
          /* ── Catalog: Provider Models (Step 2) ── */
          <ProviderModelsView
            provider={selectedProvider!}
            entry={providerEntries.find(e => e.provider === selectedProvider)}
            isMobile={isMobile}
            search={search}
            catalog={catalog}
            filteredCatalog={filteredCatalog}
            customProviderIds={customProviderIds}
            discoveredModels={discoveredModels}
            discovering={discovering}
            discoverError={discoverError}
            hoveredRow={hoveredRow}
            onHover={setHoveredRow}
            mutatingModel={mutatingModel}
            addingKey={addingKey}
            addProgress={addProgress}
            onBack={() => { setCatalogSubView('providers'); setSelectedProvider(null); setSearch(''); }}
            onAddModel={handleAddModel}
            onAddCustomModelDirect={(provider, modelId) => { void handleAddCustomModelDirect(provider, modelId); }}
            onRemoveModel={handleRemoveModel}
            onConfigure={(m) => setWizardModel(m)}
            onEditOllama={(key) => { void openOllamaSettings(key); }}
            onEditCustomModel={handleEditCustomModel}
            onDeleteFromDisk={handleDeleteFromDisk}
            onOpenAddOllama={() => setAddModelOpen(true)}
            modelTests={modelTests}
            testingModels={testingModels}
            onTestModel={(key) => { void runModelTest(key); }}
          />
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
      {addModelOpen && (
        <AddOllamaModelModal
          onClose={() => setAddModelOpen(false)}
          onAdded={() => { fetchCatalog(); fetchModels(); }}
        />
      )}
      <ConfirmDialog
        open={confirmDeleteProvider !== null}
        onClose={() => setConfirmDeleteProvider(null)}
        onConfirm={() => { void doDeleteProvider(); }}
        title="Remove provider?"
        description={confirmDeleteProvider ? `Remove provider "${confirmDeleteProvider}"? Models from this provider will be removed.` : ''}
        confirmLabel="Remove"
        variant="danger"
      />
    </ScrollArea>
  );
}

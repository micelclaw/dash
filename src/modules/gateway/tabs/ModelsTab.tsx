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
import { Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModelSetupWizard, type ProviderType } from '../components/ModelSetupWizard';
import { ModelsAdvancedView } from '../components/ModelsAdvancedView';
import { CustomModelConfigModal } from '../components/CustomModelConfigModal';
import { OllamaModelSettingsModal } from '../components/OllamaModelSettingsModal';
import { AddOllamaModelModal } from '../components/AddOllamaModelModal';
import type { GatewayModel, CatalogModel } from '../types';
import { PROVIDER_COLORS, PROVIDER_LABELS, USER_MANAGED_FIXED_PROVIDERS, isUserManagedProvider } from './models/constants';
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

  const {
    settingDefault, mutatingModel, addingKey, addProgress,
    handleSetDefault, handleAddModel, handleRemoveModel,
    handleDeleteFromDisk, handleAddCustomModelDirect,
  } = useModelMutations({ addModel, removeModel, fetchModels, fetchCatalog, fetchCustomProviders });

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
        setCustomWizardType(provider as ProviderType);
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
              {filteredModels.map((model) => {
                // GatewayModel.model viene SIN prefijo de provider para Ollama
                // ("qwen3:8b"), pero el catalog usa key con prefijo ("ollama/qwen3:8b").
                // Probar ambas formas para cruzar contexto/tamaño en todos los casos.
                const cat = catalogByKey.get(model.model)
                  ?? catalogByKey.get(`${model.provider}/${model.model}`);
                return (
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
                  contextWindow={cat?.context_window ?? null}
                  sizeBytes={cat?.size_bytes ?? null}
                />
                );
              })}
            </div>
          )
        ) : catalogSubView === 'providers' ? (
          /* ── Catalog: Provider Grid (Step 1) ── */
          <CatalogProvidersGrid
            entries={providerEntries}
            search={search}
            isMobile={isMobile}
            customProviderIds={customProviderIds}
            deletingProvider={deletingProvider}
            onProviderClick={handleProviderClick}
            onDeleteProvider={handleDeleteProvider}
            onSelectProviderType={setCustomWizardType}
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
    </ScrollArea>
  );
}

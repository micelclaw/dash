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

import { Cpu, ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { getProviderIcon } from '@/config/provider-icons';
import type * as gwService from '@/services/gateway.service';
import { StatusPill } from '../../components/StatusPill';
import type { CatalogModel, ModelTestResult } from '../../types';
import { PROVIDER_COLORS, isUserManagedProvider } from './constants';
import type { ProviderEntry } from './types';
import { CatalogRow } from './CatalogRow';

interface ProviderModelsViewProps {
  provider: string;
  entry: ProviderEntry | undefined;
  isMobile: boolean;
  search: string;
  /** Catálogo completo (sin filtrar) — para calcular las keys ya configuradas. */
  catalog: CatalogModel[];
  /** Catálogo tras el filtro de búsqueda. */
  filteredCatalog: CatalogModel[];
  customProviderIds: string[];
  discoveredModels: gwService.DiscoveredModel[];
  discovering: boolean;
  discoverError: string | null;
  hoveredRow: string | null;
  onHover: (id: string | null) => void;
  mutatingModel: string | null;
  addingKey: string | null;
  addProgress: number;
  onBack: () => void;
  onAddModel: (key: string) => void;
  onAddCustomModelDirect: (provider: string, modelId: string) => void;
  onRemoveModel: (key: string) => void;
  /** GM3: claves con borrado ENCOLADO (ventana de Deshacer del gateway.store) —
   *  la fila del catálogo se atenúa igual que la de Configured. */
  queuedRemovals: string[];
  /** GM3: claves cuyo borrado YA salió en el batch POST (hasta 90 s). Siguen
   *  atenuadas y SIN Deshacer — antes revivían con un «Remove» muerto. */
  inflightRemovals: string[];
  onUndoRemove: (key: string) => void;
  onConfigure: (model: CatalogModel) => void;
  onEditOllama: (key: string) => void;
  onEditCustomModel: (model: CatalogModel) => void;
  onDeleteFromDisk: (model: CatalogModel) => void;
  onOpenAddOllama: () => void;
  /** Tests de salud por modelo (key = 'provider/modelId') — del store. */
  modelTests: Record<string, ModelTestResult>;
  testingModels: string[];
  onTestModel: (key: string) => void;
}

export function ProviderModelsView({
  provider, entry, isMobile, search, catalog, filteredCatalog, customProviderIds,
  discoveredModels, discovering, discoverError, hoveredRow, onHover,
  mutatingModel, addingKey, addProgress, onBack, onAddModel, onAddCustomModelDirect,
  onRemoveModel, queuedRemovals, inflightRemovals, onUndoRemove, onConfigure, onEditOllama, onEditCustomModel, onDeleteFromDisk, onOpenAddOllama,
  modelTests, testingModels, onTestModel,
}: ProviderModelsViewProps) {
  const color = PROVIDER_COLORS[provider] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(provider);
  // Señal de auth del provider — viene del providers-overview vía entry.hasAuth
  // (ModelsTab la deriva de overview.has_credential). Gobierna el badge del
  // header y el gate +Add/"Configure provider" de TODAS las filas, incluidas
  // las descubiertas. Sin entry (p.ej. deep-link a un provider desconocido) =
  // sin credencial → las filas ofrecen "Configure provider", nunca +Add.
  const hasCredential = entry?.hasAuth ?? false;

  const providerModels = filteredCatalog.filter(m => m.provider === provider);
  const isCustom = customProviderIds.includes(provider);
  const q = search.toLowerCase();

  // For custom providers, surface available-to-add models
  // (discovered from the provider's /models endpoint) that
  // aren't already in the configured catalog.
  const configuredKeys = new Set(
    catalog.filter(m => m.provider === provider).map(m => m.key)
  );
  const availableToAdd = isCustom
    ? discoveredModels.filter(dm => !configuredKeys.has(`${provider}/${dm.id}`))
    : [];
  const filteredAvailable = search
    ? availableToAdd.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    : availableToAdd;

  const showLoading = isCustom && discovering && providerModels.length === 0 && discoveredModels.length === 0;
  const showError = isCustom && discoverError && providerModels.length === 0 && discoveredModels.length === 0;
  const showEmpty = providerModels.length === 0 && filteredAvailable.length === 0 && !showLoading && !showError;

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
  // don't duplicate render code. `available` ya NO se fuerza a true:
  // el gate de +Add lo decide providerHasCredential (overview) — un
  // catálogo público (OpenRouter sin key) lista modelos que NO se
  // pueden añadir sin credencial.
  const discoveredAsCatalog: CatalogModel[] = filteredAvailable.map((dm) => ({
    key: `${provider}/${dm.id}`,
    name: dm.name || dm.id,
    provider,
    context_window: null,
    input_type: 'text',
    available: hasCredential,
    configured: false,
    is_default: false,
    local: false,
    size_bytes: dm.size_bytes ?? null,
    // Metadata del catálogo CURADO — el endpoint discover ya la trae por modelo
    max_context: dm.max_context ?? null,
    max_output: dm.max_output ?? null,
    caps: dm.caps ?? null,
    knowledge: dm.knowledge ?? null,
    aa_slug: dm.aa_slug ?? null,
  }));
  // Tamaño en disco por tag (de /api/tags vía discover). Los modelos
  // Configured vienen del catálogo (sin size); se lo inyectamos cruzando
  // por tag con los descubiertos. Normaliza `:latest`.
  const sizeByTag = new Map(
    discoveredModels.map((d) => [d.id.replace(/:latest$/, ''), d.size_bytes ?? null]),
  );
  const withSize = (m: CatalogModel): CatalogModel => {
    if (m.size_bytes != null) return m;
    const tag = m.key.replace(/^ollama\//, '').replace(/:latest$/, '');
    const s = sizeByTag.get(tag);
    return s != null ? { ...m, size_bytes: s } : m;
  };
  const unifiedList: CatalogModel[] = [...providerModels, ...discoveredAsCatalog].map(withSize);

  // Count "added" from the source-of-truth `configured` flag, not
  // from `providerModels.length`. The catalog can list entries that
  // exist in `models.providers.<id>.models` (provider entry) but
  // aren't yet in `agents.defaults.models` (the allow-list that
  // marks `configured: true`). Counting by flag avoids misleading
  // numbers in that edge case.
  const addedCount = unifiedList.filter((m) => m.configured).length;

  return (
    <>
      {/* Back + provider header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Button variant="outline" size="sm" onClick={onBack} className="text-[var(--text-dim)]">
          <ArrowLeft size={12} /> All providers
        </Button>
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
            {entry?.label ?? provider}
          </span>
          {/* Badge del PROVIDER = credencial. Se etiqueta "Authenticated" para
              no colisionar con el "Available" de las filas, que desde el
              2026-07-13 significa "el modelo respondió al TEST real". */}
          {hasCredential
            ? <StatusPill status="available" label="Authenticated" title="This provider has a usable credential" />
            : <StatusPill status="no_auth" />
          }
        </div>
      </div>

      {/* Model list for selected provider */}
      {showLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="spin" /> Discovering models from {provider}...
        </div>
      ) : showError ? (
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
      ) : showEmpty ? (
        <EmptyState
          icon={Cpu}
          title={search
            ? 'No models match your search'
            : discovering
              ? 'No models available for this provider'
              : isUserManagedProvider(provider)
                // Local server / custom endpoint: el hint de "carga un modelo /
                // servidor arrancado" sí aplica.
                ? 'No models available. For a local server (Ollama/LM Studio/vLLM) make sure at least one model is loaded and the Base URL is correct.'
                // Provider cloud (google/nvidia/groq/…): si tras dar la key no
                // salen modelos, casi siempre la key es inválida o el provider
                // no devolvió catálogo.
                : 'No models found for this provider. Check that the API key is valid — the provider returned no models.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Single header with counts (+ botón Añadir solo para Ollama) */}
          {(unifiedList.length > 0 || provider === 'ollama') && (
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
              {provider === 'ollama' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenAddOllama}
                  title="Descargar y añadir un modelo local (tag de Ollama o repo GGUF de HuggingFace)"
                  style={{ marginLeft: 'auto', borderColor: 'var(--amber)' }}
                >
                  <Plus size={13} /> Añadir
                </Button>
              )}
            </div>
          )}
          {unifiedList.map((model) => (
            <CatalogRow
              key={model.key}
              model={model}
              providerHasCredential={hasCredential}
              isMobile={isMobile}
              isHovered={hoveredRow === model.key}
              onHover={onHover}
              mutatingModel={mutatingModel}
              isAdding={addingKey === model.key}
              addProgress={addProgress}
              removalQueued={queuedRemovals.includes(model.key)}
              removalInflight={inflightRemovals.includes(model.key)}
              onUndoRemove={onUndoRemove}
              testResult={modelTests[model.key] ?? null}
              isTesting={testingModels.includes(model.key)}
              onTest={onTestModel}
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
                  onAddCustomModelDirect(model.provider, modelId);
                } else {
                  onAddModel(key);
                }
              }}
              onRemove={onRemoveModel}
              onConfigure={onConfigure}
              onEdit={!model.configured
                ? undefined
                : model.provider === 'ollama'
                  // Ollama → modal de VRAM/offload (num_ctx, num_gpu, keep_alive, estimación).
                  ? (m) => { onEditOllama(m.key); }
                  // Otros user-managed (custom-api, vllm…) → editor genérico (ctx + maxTokens).
                  : isUserManagedProvider(model.provider)
                    ? onEditCustomModel
                    : undefined}
              onDeleteFromDisk={onDeleteFromDisk}
            />
          ))}
          {/* El árbitro de VRAM (estado de la GPU, modelos cargados, prioridad,
              pausar/liberar) vive ahora en Settings → AI & Agents → GPU & VRAM. */}
        </div>
      )}
    </>
  );
}

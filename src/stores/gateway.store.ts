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

import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  GatewayStatus,
  GatewayHealth,
  GatewayChannel,
  GatewayModel,
  GatewaySession,
  GatewayUsage,
  CatalogModel,
  CronJob,
  LogEntry,
  ModelTestResult,
  ProviderOverview,
} from '@/modules/gateway/types';
import { describeCredentialError } from '@/modules/gateway/lib/credential-errors';
import * as gw from '@/services/gateway.service';

interface GatewayStore {
  // State
  configured: boolean | null;
  status: GatewayStatus | null;
  health: GatewayHealth | null;
  channels: GatewayChannel[];
  models: GatewayModel[];
  sessions: GatewaySession[];
  usage: GatewayUsage | null;
  cronJobs: CronJob[];
  logs: LogEntry[];

  // Loading / error per section
  statusLoading: boolean;
  statusError: string | null;
  channelsLoading: boolean;
  channelsError: string | null;
  modelsLoading: boolean;
  modelsError: string | null;
  sessionsLoading: boolean;
  sessionsError: string | null;
  cronLoading: boolean;
  cronError: string | null;
  catalog: CatalogModel[];
  catalogLoading: boolean;
  catalogError: string | null;
  logsLoading: boolean;
  logsError: string | null;

  // SSOT de auth por proveedor (providers-overview). null = aún sin cargar.
  // Su error NUNCA se traga en silencio: la UI muestra estado de error con
  // Retry (un fallo silencioso pintaría "todo sin auth", el bug histórico).
  providersOverview: ProviderOverview[] | null;
  providersOverviewLoading: boolean;
  providersOverviewError: string | null;
  catalogWarm: boolean;

  // Tests de salud por modelo (key = 'provider/modelId'). "Available" en una
  // fila = respondió a un test REAL (1-token completion), no "hay credencial".
  // Los resultados viven en Core hasta reinicio → hydrateModelTests() los
  // rehidrata tras un F5.
  modelTests: Record<string, ModelTestResult>;
  testingModels: string[];

  // Cola de borrado de modelos (batch). Vive en el store (no useState local):
  // el estado async deriva del backend/store y sobrevive a desmontar el tab —
  // el flush completa aunque el usuario navegue fuera.
  //   queuedRemovals  → tarjetas atenuadas con botón "Deshacer" (ventana de
  //                     gracia = debounce de 1.2s desde el último click).
  //   inflightRemovals → ocultas del render mientras el POST batch está en vuelo.
  queuedRemovals: string[];
  inflightRemovals: string[];

  // Actions
  fetchSnapshot: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchCronJobs: () => Promise<void>;
  fetchCatalog: () => Promise<void>;
  fetchProvidersOverview: () => Promise<void>;
  runModelTest: (key: string) => Promise<void>;
  hydrateModelTests: () => Promise<void>;
  addModel: (model: string) => Promise<void>;
  removeModel: (model: string) => Promise<void>;
  queueRemoveModel: (key: string) => void;
  undoRemoveModel: (key: string) => void;
  fetchLogs: (limit?: number) => Promise<void>;
  gatewayStart: () => Promise<void>;
  gatewayStop: () => Promise<void>;
  gatewayRestart: () => Promise<void>;
}

// ─── Cola de borrado batch (module-level: el timer no depende del render) ───
const REMOVAL_DEBOUNCE_MS = 1_200;
let removalFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRemovalFlush(): void {
  if (removalFlushTimer) clearTimeout(removalFlushTimer);
  removalFlushTimer = setTimeout(() => {
    removalFlushTimer = null;
    void flushRemovals();
  }, REMOVAL_DEBOUNCE_MS);
}

async function flushRemovals(): Promise<void> {
  const store = useGatewayStore.getState();
  // Un solo batch en vuelo; el finally encadena si entró cola nueva mientras.
  if (store.inflightRemovals.length > 0) return;
  const batch = store.queuedRemovals;
  if (batch.length === 0) return;
  useGatewayStore.setState({ queuedRemovals: [], inflightRemovals: batch });
  try {
    await gw.removeModels(batch);
    useGatewayStore.setState((s) => ({
      inflightRemovals: [],
      models: s.models.filter((m) => !batch.includes(m.id || `${m.provider}/${m.model}`)),
      // Parche client-side del flag derivado — réplica exacta de lo que el
      // servidor recomputa (patch in-place de tags). SIN fetchCatalog: era el
      // coste de ~20s (respawn del CLI) que hacía lento cada borrado.
      catalog: s.catalog.map((c) => (batch.includes(c.key) ? { ...c, configured: false } : c)),
    }));
    toast.success(batch.length === 1 ? `Removed ${batch[0]}` : `Removed ${batch.length} models`);
    const fresh = useGatewayStore.getState();
    void Promise.all([fresh.fetchModels(), fresh.fetchProvidersOverview()]);
  } catch (err) {
    // Rollback: el ocultado es un filtro de render → vaciar inflight hace
    // reaparecer las tarjetas solas.
    useGatewayStore.setState({ inflightRemovals: [] });
    const msg = err instanceof Error ? err.message : 'Failed to remove models';
    const timedOut = /timed?\s*out|abort/i.test(msg);
    toast.error(timedOut
      ? 'Removal took too long — it may still land on the server; the list will reconcile shortly'
      : msg);
    if (timedOut) {
      // La escritura pudo aterrizar tras el timeout: reconciliar en diferido.
      setTimeout(() => { void useGatewayStore.getState().fetchModels(); }, 20_000);
    }
  } finally {
    if (useGatewayStore.getState().queuedRemovals.length > 0) void flushRemovals();
  }
}

export const useGatewayStore = create<GatewayStore>()((set) => ({
  configured: null,
  status: null,
  health: null,
  channels: [],
  models: [],
  sessions: [],
  usage: null,
  cronJobs: [],
  logs: [],

  statusLoading: false,
  statusError: null,
  channelsLoading: false,
  channelsError: null,
  modelsLoading: false,
  modelsError: null,
  sessionsLoading: false,
  sessionsError: null,
  catalog: [],
  catalogLoading: false,
  catalogError: null,
  cronLoading: false,
  cronError: null,
  logsLoading: false,
  logsError: null,

  providersOverview: null,
  providersOverviewLoading: false,
  providersOverviewError: null,
  catalogWarm: false,

  modelTests: {},
  testingModels: [],

  queuedRemovals: [],
  inflightRemovals: [],

  fetchSnapshot: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      const snap = await gw.getSnapshot();
      set({
        configured: snap.configured ?? null,
        status: snap.status,
        health: snap.health,
        channels: snap.channels?.channels ?? [],
        models: snap.models?.models ?? [],
        sessions: snap.sessions?.sessions ?? [],
        statusLoading: false,
        channelsLoading: false,
        modelsLoading: false,
        sessionsLoading: false,
      });

      // If runtime data wasn't ready (CLI still warming up), re-fetch in 3s
      if (!snap._runtime_ready) {
        setTimeout(async () => {
          try {
            const retry = await gw.getSnapshot();
            set({
              status: retry.status,
              health: retry.health,
              sessions: retry.sessions?.sessions ?? [],
            });
          } catch {
            // Silent — next polling cycle will pick it up
          }
        }, 3_000);
      }
    } catch (err) {
      set({
        statusError: err instanceof Error ? err.message : 'Failed to fetch snapshot',
        statusLoading: false,
      });
    }
  },

  fetchStatus: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      const [status, health] = await Promise.all([
        gw.getGatewayStatus(),
        gw.getGatewayHealth(),
      ]);
      set({ status, health, statusLoading: false });
    } catch (err) {
      set({
        statusError: err instanceof Error ? err.message : 'Failed to fetch status',
        statusLoading: false,
      });
    }
  },

  fetchHealth: async () => {
    try {
      const health = await gw.getGatewayHealth();
      set({ health });
    } catch {
      // Silently fail — status page handles errors
    }
  },

  fetchChannels: async () => {
    set({ channelsLoading: true, channelsError: null });
    try {
      const channels = await gw.getChannels();
      set({ channels, channelsLoading: false });
    } catch (err) {
      set({
        channelsError: err instanceof Error ? err.message : 'Failed to fetch channels',
        channelsLoading: false,
      });
    }
  },

  fetchModels: async () => {
    set({ modelsLoading: true, modelsError: null });
    try {
      const models = await gw.getModels();
      set({ models, modelsLoading: false });
    } catch (err) {
      set({
        modelsError: err instanceof Error ? err.message : 'Failed to fetch models',
        modelsLoading: false,
      });
    }
  },

  fetchSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await gw.getSessions();
      set({ sessions, sessionsLoading: false });
    } catch (err) {
      set({
        sessionsError: err instanceof Error ? err.message : 'Failed to fetch sessions',
        sessionsLoading: false,
      });
    }
  },

  fetchUsage: async () => {
    try {
      const usage = await gw.getUsage();
      set({ usage });
    } catch {
      // Non-critical
    }
  },

  fetchCronJobs: async () => {
    set({ cronLoading: true, cronError: null });
    try {
      const cronJobs = await gw.getCronJobs();
      set({ cronJobs, cronLoading: false });
    } catch (err) {
      set({
        cronError: err instanceof Error ? err.message : 'Failed to fetch cron jobs',
        cronLoading: false,
      });
    }
  },

  fetchCatalog: async () => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const result = await gw.getModelCatalog();
      set({ catalog: result.models, catalogLoading: false });
    } catch (err) {
      set({
        catalogError: err instanceof Error ? err.message : 'Failed to fetch catalog',
        catalogLoading: false,
      });
    }
  },

  fetchProvidersOverview: async () => {
    set({ providersOverviewLoading: true, providersOverviewError: null });
    try {
      const res = await gw.getProvidersOverview();
      set({
        providersOverview: res.providers,
        catalogWarm: res.catalog_warm,
        providersOverviewLoading: false,
      });
    } catch (err) {
      set({
        providersOverviewError: err instanceof Error ? err.message : 'Failed to fetch providers overview',
        providersOverviewLoading: false,
      });
    }
  },

  runModelTest: async (key: string) => {
    if (useGatewayStore.getState().testingModels.includes(key)) return;
    set((s) => ({ testingModels: [...s.testingModels, key] }));
    try {
      const result = await gw.testModel(key);
      set((s) => ({ modelTests: { ...s.modelTests, [key]: result } }));
    } catch (err) {
      // 409 PROVIDER_NOT_AUTHENTICATED / 400 NO_BASE_URL_TO_TEST / red: mismo
      // patrón de credential-errors que las mutaciones → toast legible con el
      // mensaje del backend. El pill previo (si lo había) se conserva.
      toast.error(describeCredentialError(err, `Failed to test ${key}`));
    } finally {
      set((s) => ({ testingModels: s.testingModels.filter((k) => k !== key) }));
    }
  },

  hydrateModelTests: async () => {
    // Silencioso-tolerante: sin rehidratación los pills simplemente no salen
    // hasta el próximo test manual. Los resultados frescos de esta sesión
    // (modelTests actuales) ganan sobre los persistidos en Core.
    try {
      const tests = await gw.getModelTests();
      set((s) => ({ modelTests: { ...tests, ...s.modelTests } }));
    } catch { /* no crítico */ }
  },

  addModel: async (model: string) => {
    // Si el key estaba encolado para borrar, el add lo rescata de la cola.
    set((s) => ({ queuedRemovals: s.queuedRemovals.filter((k) => k !== model) }));
    await gw.addModel(model);
    const store = useGatewayStore.getState();
    // Invalidación encadenada: el overview refleja configured_count y (tras
    // añadir el primer modelo de un provider) entry_in_config → refetch junto
    // a models/catalog para que todas las vistas queden coherentes.
    await Promise.all([store.fetchModels(), store.fetchCatalog(), store.fetchProvidersOverview()]);
  },

  // Borrado inmediato de UN modelo (sin cola/debounce) — lo usa el flujo de
  // borrado-de-disco de Ollama, donde el catálogo SÍ cambia y toca refetch.
  removeModel: async (model: string) => {
    await gw.removeModel(model);
    const store = useGatewayStore.getState();
    await Promise.all([store.fetchModels(), store.fetchCatalog(), store.fetchProvidersOverview()]);
  },

  queueRemoveModel: (key: string) => {
    set((s) => (
      s.queuedRemovals.includes(key) || s.inflightRemovals.includes(key)
        ? s
        : { queuedRemovals: [...s.queuedRemovals, key] }
    ));
    scheduleRemovalFlush();
  },

  undoRemoveModel: (key: string) => {
    set((s) => ({ queuedRemovals: s.queuedRemovals.filter((k) => k !== key) }));
  },

  fetchLogs: async (limit = 200) => {
    set({ logsLoading: true, logsError: null });
    try {
      const logs = await gw.getLogs(limit);
      set({ logs, logsLoading: false });
    } catch (err) {
      set({
        logsError: err instanceof Error ? err.message : 'Failed to fetch logs',
        logsLoading: false,
      });
    }
  },

  gatewayStart: async () => {
    await gw.startGateway();
  },

  gatewayStop: async () => {
    await gw.stopGateway();
  },

  gatewayRestart: async () => {
    await gw.restartGateway();
  },
}));

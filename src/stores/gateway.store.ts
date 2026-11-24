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
import { useAuthStore } from '@/stores/auth.store';
import { canonicalModelAddKey, configureModelAddHooks, findModelAddEntry, useGatewayModelAddStore } from '@/stores/gateway-model-add.store';
import { ApiError } from '@/services/api';
import { toast } from 'sonner';
import type {
  GatewayStatus,
  GatewayConfiguration,
  GatewayOperation,
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
  CatalogProvider,
  InstallableCatalogProvider,
} from '@/modules/gateway/types';
import { describeCredentialError } from '@/modules/gateway/lib/credential-errors';
import * as gw from '@/services/gateway.service';

type ModelRemovalOperation = {
  requestId: string;
  canonicalId?: string;
  preparationId?: string;
  canReconcile?: boolean;
  models: string[];
  state: 'preparing' | 'running' | 'uncertain';
  code?: string;
  message?: string;
};
interface GatewayStore {
  // State
  configured: boolean | null;
  configuration: GatewayConfiguration | null;
  gatewayOperation: GatewayOperation | null;
  pendingGatewayRequestId: string | null;
  operationUncertain: boolean;
  operationError: string | null;
  operationPermissionDenied: boolean;
  modelsCheckedAt: string | null;
  channelsCheckedAt: string | null;
  sessionsCheckedAt: string | null;
  status: GatewayStatus | null;
  health: GatewayHealth | null;
  channels: GatewayChannel[];
  channelsRuntime: gw.GatewayChannelObservation | null;
  models: GatewayModel[];
  sessions: GatewaySession[];
  usage: GatewayUsage | null;
  usageLoading: boolean;
  usageError: boolean;
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
  catalogProviders: CatalogProvider[];
  installableProviders: InstallableCatalogProvider[];
  catalogOpenclawVersion: string | null;
  catalogDegraded: boolean;
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
  removalOperation: ModelRemovalOperation | null;
  checkRemovalOperation: () => Promise<void>;

  // Actions
  fetchSnapshot: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchChannels: (observeRuntime?: boolean) => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchCronJobs: () => Promise<void>;
  fetchCatalog: (refresh?: boolean) => Promise<void>;
  fetchProvidersOverview: () => Promise<void>;
  runModelTest: (key: string) => Promise<void>;
  hydrateModelTests: () => Promise<void>;
  addModel: (model: string) => Promise<void>;
  confirmModelAdd: (model: string) => void;
  removeModel: (model: string) => Promise<void>;
  queueRemoveModel: (key: string) => void;
  undoRemoveModel: (key: string) => void;
  fetchLogs: (limit?: number) => Promise<void>;
  gatewayStart: () => Promise<GatewayOperation | null>;
  gatewayStop: () => Promise<GatewayOperation | null>;
  gatewayRestart: () => Promise<GatewayOperation | null>;
  gatewayRecover: () => Promise<GatewayOperation | null>;
  checkGatewayOperation: () => Promise<GatewayOperation | null>;
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

// Los IDs y nombres de la operación no contienen credenciales. La escritura
// se envía una sola vez y el estado se reconcilia por ID tras perder respuesta.
const removalUnsettled = new Set<string>();
let removalEpoch = 0;
let removalRead: Promise<void> | null = null;
let removalStorageInvalid = false;
type RemovalIdentity = { id: string; role: string; generation: number };
function removalIdentity(): RemovalIdentity | null {
  const auth = useAuthStore.getState();
  return auth.isAuthenticated && auth.user ? { id: auth.user.id, role: auth.user.role, generation: auth.sessionGeneration } : null;
}
function liveRemoval(owner: RemovalIdentity, serial: number): boolean {
  const now = removalIdentity();
  return serial === removalEpoch && now?.id === owner.id && now.role === owner.role && now.generation === owner.generation;
}
function removalStorageKey(id: string): string { return `micelclaw-model-remove:${id}`; }
function persistRemoval(owner: RemovalIdentity, operation: ModelRemovalOperation | null): void {
  if (operation) sessionStorage.setItem(removalStorageKey(owner.id), JSON.stringify(operation));
  else sessionStorage.removeItem(removalStorageKey(owner.id));
}
function publishRemoval(owner: RemovalIdentity, operation: ModelRemovalOperation, required = false): void {
  if (required) persistRemoval(owner, operation);
  else try { persistRemoval(owner, operation); } catch { /* El ID anterior sigue guardado. */ }
  useGatewayStore.setState({ removalOperation: operation, inflightRemovals: operation.models });
}
function sameRemovalModels(left: string[], right: string[]): boolean {
  const a = left.map(canonicalModelAddKey), b = right.map(canonicalModelAddKey);
  return !a.includes(null) && !b.includes(null) && a.length === b.length && [...a].sort().join('\0') === [...b].sort().join('\0');
}
function validRemovalReceipt(operation: ModelRemovalOperation, receipt: gw.ModelRemoveReceipt | null): boolean {
  return !!receipt && typeof receipt.id === 'string' && /^\d{13}\.[a-f0-9-]{36}$/i.test(receipt.id)
    && (!operation.canonicalId || operation.canonicalId === receipt.id)
    && Array.isArray(receipt.models) && receipt.models.every(value => typeof value === 'string')
    && sameRemovalModels(operation.models, receipt.models);
}
function failedRemovalMessage(code?: string): string {
  if (code === 'RETRY_AVAILABLE') return 'La operación anterior terminó. Puedes volver a retirar el modelo.';
  if (code === 'ACCESS_DENIED') return 'Ya no tienes permiso para retirar este modelo.';
  if (code === 'CONFIG_CHANGED') return 'La configuración cambió. Comprueba los modelos antes de volver a retirar.';
  return 'No se pudo retirar el modelo. Comprueba la configuración antes de volver a intentarlo.';
}
async function acceptRemoval(owner: RemovalIdentity, serial: number, operation: ModelRemovalOperation,
  result: gw.ModelRemoveOperationRead): Promise<boolean> {
  if (!liveRemoval(owner, serial) || useGatewayStore.getState().removalOperation?.requestId !== operation.requestId) return true;
  const receipt = result.operation;
  if (!validRemovalReceipt(operation, receipt)) {
    publishRemoval(owner, { ...operation, state: 'uncertain', message: 'No se pudo confirmar la retirada. Comprueba su resultado antes de repetirla.' });
    return true;
  }
  const next = { ...operation, canonicalId: receipt!.id };
  if (receipt!.state === 'failed') {
    // El servicio sólo usa failed cuando garantiza que no despachó escritura.
    try { persistRemoval(owner, null); } catch { publishRemoval(owner, { ...next, state: 'uncertain', message: 'No se pudo guardar la comprobación. Revisa el almacenamiento del navegador.' }); return true; }
    operation.models.forEach(key => removalUnsettled.delete(canonicalModelAddKey(key) ?? key));
    useGatewayStore.setState({ removalOperation: null, inflightRemovals: [] });
    toast.error(failedRemovalMessage(receipt!.code));
    if (useGatewayStore.getState().queuedRemovals.length) void flushRemovals();
    return true;
  }
  if (receipt!.state === 'succeeded' && result.current === 'absent') {
    // Confirmación actual de ausencia, no sólo recibo histórico de éxito.
    try { persistRemoval(owner, null); } catch { publishRemoval(owner, { ...next, state: 'uncertain', message: 'No se pudo guardar la comprobación. Revisa el almacenamiento del navegador.' }); return true; }
    operation.models.forEach(key => { removalUnsettled.delete(canonicalModelAddKey(key) ?? key); useGatewayModelAddStore.getState().forgetModelAdd(key); });
    const ids = new Set(operation.models.map(canonicalModelAddKey));
    inventoryReads.models++; inventoryReads.catalog++; inventoryReads.providers++;
    useGatewayStore.setState(state => ({ removalOperation: null, inflightRemovals: [],
      models: state.models.filter(model => !ids.has(canonicalModelAddKey(model.id || `${model.provider}/${model.model}`))),
      catalog: state.catalog.map(model => ids.has(canonicalModelAddKey(model.key)) ? { ...model, configured: false } : model),
    }));
    toast.success(operation.models.length === 1 ? `Retirado ${operation.models[0]}` : `Retirados ${operation.models.length} modelos`);
    const store = useGatewayStore.getState();
    void Promise.all([store.fetchModels(), store.fetchProvidersOverview()]);
    if (store.queuedRemovals.length) void flushRemovals();
    return true;
  }
  if (receipt!.state === 'queued' || receipt!.state === 'checking') {
    publishRemoval(owner, { ...next, state: 'running', message: 'Retirando…' });
    return false;
  }
  publishRemoval(owner, { ...next, state: 'uncertain', code: receipt!.code, canReconcile: receipt!.can_reconcile !== false,
    message: receipt!.state === 'uncertain' && receipt!.can_reconcile === false
      ? 'No se puede confirmar esta retirada. Revisa los modelos configurados o contacta con un administrador.'
      : receipt!.code === 'MODEL_OPERATION_MODEL_BUSY' ? 'Hay otra operación pendiente. Comprueba cuándo termina antes de retirar.'
      : 'No se pudo confirmar la retirada. Comprueba su resultado antes de repetirla.' });
  return true;
}
async function pollRemoval(owner: RemovalIdentity, serial: number): Promise<void> {
  if (removalRead) return removalRead;
  const task = (async () => {
    for (let i = 0; i < 15 && liveRemoval(owner, serial); i++) {
      const operation = useGatewayStore.getState().removalOperation;
      if (!operation || !operation.requestId || operation.canReconcile === false || (operation.code === 'MODEL_OPERATION_MODEL_BUSY' && !operation.canonicalId)) return;
      try {
        const result = await gw.readModelRemoveOperation(operation.requestId);
        if (await acceptRemoval(owner, serial, operation, result)) return;
      } catch {
        if (liveRemoval(owner, serial) && useGatewayStore.getState().removalOperation?.requestId === operation.requestId)
          publishRemoval(owner, { ...operation, state: 'uncertain', message: 'No se pudo comprobar la retirada. No se enviará otra solicitud.' });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    const operation = useGatewayStore.getState().removalOperation;
    if (liveRemoval(owner, serial) && operation?.state === 'running') publishRemoval(owner, { ...operation, state: 'uncertain', message: 'La retirada sigue pendiente. Comprueba su resultado.' });
  })();
  removalRead = task;
  try { await task; } finally { if (removalRead === task) removalRead = null; }
}
async function checkModelRemoval(): Promise<void> {
  const owner = removalIdentity(); if (owner && useGatewayStore.getState().removalOperation) await pollRemoval(owner, removalEpoch);
}
function resumeRemoval(): void {
  removalEpoch++; removalRead = null; removalStorageInvalid = false;
  const owner = removalIdentity();
  useGatewayStore.setState({ removalOperation: null, inflightRemovals: [] });
  if (!owner) return;
  try {
    const raw = sessionStorage.getItem(removalStorageKey(owner.id));
    if (!raw) return;
    const value = JSON.parse(raw) as ModelRemovalOperation;
    if (!value || typeof value.requestId !== 'string' || !/^\d{13}\.[a-f0-9-]{36}$/i.test(value.requestId)
      || value.canonicalId !== undefined && (typeof value.canonicalId !== 'string' || !/^\d{13}\.[a-f0-9-]{36}$/i.test(value.canonicalId))
      || !Array.isArray(value.models) || !value.models.length || value.models.length > 50
      || value.models.some(model => typeof model !== 'string' || !canonicalModelAddKey(model))
      || !['running','uncertain'].includes(value.state)) throw new Error('invalid');
    value.models.forEach(model => removalUnsettled.add(canonicalModelAddKey(model)!));
    publishRemoval(owner, { ...value, state: 'uncertain', message: value.canReconcile === false
      ? 'No se puede confirmar esta retirada. Revisa los modelos configurados o contacta con un administrador.'
      : value.code === 'MODEL_OPERATION_MODEL_BUSY'
        ? 'Hay otra operación anterior sin confirmar. Comprueba su resultado o contacta con un administrador.'
        : 'Comprobando el resultado de la retirada…' });
    if (value.canReconcile !== false && (value.code !== 'MODEL_OPERATION_MODEL_BUSY' || !!value.canonicalId)) void pollRemoval(owner, removalEpoch);
  } catch {
    removalStorageInvalid = true;
    useGatewayStore.setState({ removalOperation: { requestId: '', models: [], state: 'uncertain', message: 'No se pueden leer las retiradas pendientes. Comprueba el almacenamiento del navegador.' }, inflightRemovals: [] });
  }
}
async function flushRemovals(): Promise<void> {
  const store = useGatewayStore.getState();
  const owner = removalIdentity(), serial = removalEpoch;
  if (!owner || removalStorageInvalid || store.removalOperation || store.inflightRemovals.length || !store.queuedRemovals.length) return;
  const models = [...new Map(store.queuedRemovals.map(key => [canonicalModelAddKey(key), key])).values()];
  if (models.some(key => !canonicalModelAddKey(key)) || models.length > 50) {
    toast.error('Revisa los nombres de los modelos; se pueden retirar hasta 50 cada vez.'); return;
  }
  const initial: ModelRemovalOperation = { requestId: '', preparationId: crypto.randomUUID(), models, state: 'preparing', message: 'Preparando retirada…' };
  models.forEach(key => removalUnsettled.add(canonicalModelAddKey(key)!));
  useGatewayStore.setState({ queuedRemovals: [], inflightRemovals: models, removalOperation: initial });
  let operation = initial;
  try {
    const clock = await gw.readModelRemoveOperation();
    const current = useGatewayStore.getState().removalOperation;
    if (!liveRemoval(owner, serial) || current?.state !== 'preparing' || current.preparationId !== initial.preparationId || !current.models.length) return;
    if (!Number.isSafeInteger(clock?.server_time_ms) || String(clock.server_time_ms).length !== 13) throw new Error('MODEL_REMOVE_CLOCK_INVALID');
    operation = { ...current, state: 'running', requestId: `${clock.server_time_ms}.${crypto.randomUUID()}` };
    publishRemoval(owner, operation, true);
  } catch (error) {
    const current = useGatewayStore.getState().removalOperation;
    if (liveRemoval(owner, serial) && current?.state === 'preparing' && current.preparationId === initial.preparationId) {
      current.models.forEach(key => removalUnsettled.delete(canonicalModelAddKey(key)!));
      useGatewayStore.setState({ removalOperation: null, inflightRemovals: [] });
      const access = error instanceof ApiError && (error.status === 401 || error.status === 403);
      toast.error(access ? 'Tu sesión no tiene permiso para retirar modelos. Solicita acceso a un administrador.' : 'No se pudo preparar el seguimiento. No se ha enviado ninguna retirada.');
      if (useGatewayStore.getState().queuedRemovals.length) scheduleRemovalFlush();
    }
    return;
  }
  try {
    const receipt = await gw.startModelRemoveOperation(operation.models, operation.requestId);
    if (!liveRemoval(owner, serial) || useGatewayStore.getState().removalOperation?.requestId !== operation.requestId) return;
    if (!validRemovalReceipt(operation, receipt)) { publishRemoval(owner, { ...operation, state: 'uncertain', message: 'La respuesta no se pudo confirmar. Comprueba el resultado.' }); return; }
    // Incluso un succeeded devuelto aquí podría ser un recibo histórico.
    publishRemoval(owner, { ...operation, canonicalId: receipt.id, state: 'uncertain', code: receipt.code,
      canReconcile: receipt.can_reconcile !== false, message: receipt.state === 'uncertain' && receipt.can_reconcile === false
        ? 'No se puede confirmar esta retirada. Revisa los modelos configurados o contacta con un administrador.'
        : receipt.code === 'MODEL_OPERATION_MODEL_BUSY' ? 'Hay otra operación pendiente. Comprueba cuándo termina antes de retirar.'
        : 'Comprobando el resultado de la retirada…' });
    if (receipt.state !== 'uncertain') void pollRemoval(owner, serial);
  } catch (error) {
    if (!liveRemoval(owner, serial) || useGatewayStore.getState().removalOperation?.requestId !== operation.requestId) return;
    if (error instanceof ApiError && error.status === 409 && error.code === 'MODEL_OPERATION_MODEL_BUSY') {
      publishRemoval(owner, { ...operation, state: 'uncertain', code: error.code, message: 'Hay otra operación anterior sin confirmar. Espera o contacta con un administrador.' });
      return;
    }
    publishRemoval(owner, { ...operation, state: 'uncertain', message: 'La respuesta no se pudo confirmar. Comprueba el resultado.' });
    void pollRemoval(owner, serial);
  }
}

// One lightweight availability request for every consumer. A mutation/session
// invalidates prior reads; a late response cannot restore an older state.
let availabilityEpoch = 0;
let operationEpoch = 0;
let availabilityFlight: { auth: string; epoch: number; controller: AbortController; promise: Promise<void> } | null = null;
let operationFlight: { auth: string; action: GatewayOperation['action']; promise: Promise<GatewayOperation | null> } | null = null;
const inventoryReads = { channels: 0, models: 0, sessions: 0, usage: 0, catalog: 0, providers: 0 };
function gatewayAuthKey(): string {
  const { user, sessionGeneration } = useAuthStore.getState();
  return `${sessionGeneration}:${user?.id ?? ''}:${user?.role ?? ''}`;
}
type LifecycleMarker = { requestId: string; action: GatewayOperation['action']; observingOther?: true };
function lifecycleStorageKey(): string | null {
  const { user, isAuthenticated } = useAuthStore.getState();
  return isAuthenticated && user?.id && user.role ? `micelclaw-gateway-lifecycle:${encodeURIComponent(user.id)}:${encodeURIComponent(user.role)}` : null;
}
function persistLifecycleMarker(marker: LifecycleMarker | null): void {
  const key = lifecycleStorageKey();
  if (!key) throw new Error('No hay una identidad de sesión para guardar la operación.');
  if (marker) {
    const raw = JSON.stringify(marker);
    sessionStorage.setItem(key, raw);
    if (sessionStorage.getItem(key) !== raw) throw new Error('No se puede guardar la operación en esta pestaña.');
  } else {
    sessionStorage.removeItem(key);
    if (sessionStorage.getItem(key) !== null) throw new Error('No se puede actualizar el seguimiento en esta pestaña.');
  }
}
function adoptLifecycleReceipt(operation: GatewayOperation, requestId: string): boolean {
  const state = useGatewayStore.getState();
  if (state.pendingGatewayRequestId !== requestId || operation.request_id !== requestId) return false;
  try {
    const key = lifecycleStorageKey();
    const marker = key && JSON.parse(sessionStorage.getItem(key) ?? 'null') as LifecycleMarker | null;
    if (!marker || marker.requestId !== requestId || marker.action !== operation.action) return false;
  } catch { return false; }
  if (operation.state === 'failed') {
    // El contrato actual no distingue rechazo de ejecución de resultado incierto.
    const message = operation.action === 'restart'
      ? 'No se ha confirmado el reinicio. Comprueba de nuevo y, si sigue sin confirmarse, contacta con un administrador.'
      : 'No se ha confirmado la operación. Comprueba de nuevo y, si sigue sin confirmarse, contacta con un administrador.';
    useGatewayStore.setState({ gatewayOperation: { ...operation, message }, operationUncertain: true, operationError: message });
    return true;
  }
  if (operation.state !== 'running') {
    try { persistLifecycleMarker(null); } catch {
      useGatewayStore.setState({ operationUncertain: true, operationError: 'No se puede actualizar el seguimiento en esta pestaña.' });
      return true;
    }
  }
  useGatewayStore.setState({ gatewayOperation: operation, operationUncertain: false, operationError: null,
    pendingGatewayRequestId: operation.state === 'running' ? requestId : null });
  return true;
}
function resumeLifecycleOperation(): void {
  const key = lifecycleStorageKey();
  if (!key) return;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const marker = JSON.parse(raw) as LifecycleMarker;
    if (!marker || typeof marker.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(marker.requestId)
      || !['start', 'recover', 'stop', 'restart'].includes(marker.action)
      || marker.observingOther !== undefined && marker.observingOther !== true) throw new Error('invalid marker');
    useGatewayStore.setState({ gatewayOperation: null, pendingGatewayRequestId: marker.requestId, operationUncertain: true,
      operationError: 'Comprobando la operación anterior. No se enviará otra solicitud.' });
    void reconcileGatewayOperation();
  } catch {
    useGatewayStore.setState({ operationUncertain: true, operationError: 'No se puede leer el seguimiento de Gateway en esta pestaña. No se enviará ninguna acción.' });
  }
}
function invalidateAvailability(): void {
  availabilityEpoch += 1;
  availabilityFlight?.controller.abort();
  availabilityFlight = null;
  useGatewayStore.setState({ statusLoading: false, channelsLoading: false, modelsLoading: false, sessionsLoading: false });
}
function canAdoptGatewayOperation(incoming: GatewayOperation, current: GatewayOperation | null): boolean {
  if (!current) return true;
  if (current.id === incoming.id) return current.state === 'running' || incoming.state === current.state;
  return Date.parse(incoming.started_at) >= Date.parse(current.started_at);
}
function readAvailability(): Promise<void> {
  const auth = gatewayAuthKey();
  if (availabilityFlight?.auth === auth && availabilityFlight.epoch === availabilityEpoch) return availabilityFlight.promise;
  const epoch = availabilityEpoch;
  const task = { auth, epoch, controller: new AbortController(), promise: Promise.resolve() };
  availabilityFlight = task;
  useGatewayStore.setState({ statusLoading: true, statusError: null });
  task.promise = (async () => {
    try {
      const snap = await gw.getSnapshot(task.controller.signal);
      if (gatewayAuthKey() !== auth || availabilityEpoch !== epoch) return;
      const previous = useGatewayStore.getState();
      // Old Core may still be loaded during the coordinated cutover. Its generic
      // catch used configured:false/running:false: neither is reliable evidence.
      const currentContract = typeof snap.status.availability === 'string';
      const status = currentContract ? snap.status : {
        ...snap.status, availability: 'unknown' as const, stale: true,
      };
      // The legacy health value is derived from the same failed aggregate. It
      // cannot independently prove that the service is down or reachable.
      const health = currentContract ? snap.health : { ...snap.health, status: 'unknown' as const, stale: true };
      const configuration = snap.configuration ?? previous.configuration;
      const configured = configuration?.state === 'valid' ? true
        : configuration?.state === 'missing' || configuration?.state === 'invalid' ? false : previous.configured;
      const operation = snap.operation;
      const acceptsOperation = operation && (!previous.pendingGatewayRequestId || operation.request_id === previous.pendingGatewayRequestId)
        && (!previous.operationUncertain || !!previous.pendingGatewayRequestId) && canAdoptGatewayOperation(operation, previous.gatewayOperation);
      useGatewayStore.setState({
        configured, configuration, status,
        health,
        ...(snap.channels ? { channels: snap.channels.channels, channelsCheckedAt: new Date().toISOString() } : {}),
        ...(acceptsOperation && !previous.pendingGatewayRequestId ? {
          gatewayOperation: operation,
          operationUncertain: false,
          pendingGatewayRequestId: operation.state === 'running' ? previous.pendingGatewayRequestId : null,
        } : {}),
        statusLoading: false,
      });
      if (acceptsOperation && previous.pendingGatewayRequestId && !adoptLifecycleReceipt(operation, previous.pendingGatewayRequestId))
        useGatewayStore.setState({ operationUncertain: true, operationError: 'La respuesta no corresponde a la operación pendiente. No se repetirá la solicitud.' });
    } catch (err) {
      if (gatewayAuthKey() !== auth || availabilityEpoch !== epoch) return;
      const error = err instanceof Error ? err.message : 'No se pudo comprobar Gateway';
      useGatewayStore.setState((state) => ({
        statusError: error, statusLoading: false,
        status: state.status ? { ...state.status, availability: 'unknown', stale: true, message: 'No se ha podido actualizar la conexión. Los datos anteriores no confirman su estado actual.', last_known: state.status.last_known ?? (state.status.checked_at ? { running: state.status.running, reachable: state.status.reachable, checked_at: state.status.checked_at } : undefined) } : null,
        health: state.health ? { ...state.health, status: 'unknown', stale: true } : null,
      }));
    } finally {
      if (availabilityFlight === task) availabilityFlight = null;
    }
  })();
  return task.promise;
}
async function reconcileGatewayOperation(): Promise<GatewayOperation | null> {
  const auth = gatewayAuthKey();
  const requestId = useGatewayStore.getState().pendingGatewayRequestId ?? undefined;
  const epoch = operationEpoch;
  if (!requestId && useGatewayStore.getState().operationUncertain) return null;
  try {
    const key = lifecycleStorageKey();
    const marker = requestId && key ? JSON.parse(sessionStorage.getItem(key) ?? 'null') as LifecycleMarker | null : null;
    if (requestId && (!marker || marker.requestId !== requestId)) throw new Error('No se puede leer el seguimiento de Gateway en esta pestaña.');
    const observingOther = marker?.observingOther === true;
    const operation = await gw.getGatewayOperation(observingOther ? undefined : requestId);
    if (gatewayAuthKey() !== auth || operationEpoch !== epoch) return null;
    if (observingOther) {
      // The conflict response did not identify the prior operation. A later
      // global receipt may belong to another one, including after a restart.
      useGatewayStore.setState({ gatewayOperation: null, operationUncertain: true,
        operationError: 'No se puede comprobar cuál era la operación anterior. Contacta con un administrador.' });
      return null;
    }
    if (operation && !canAdoptGatewayOperation(operation, useGatewayStore.getState().gatewayOperation)) {
      const current = useGatewayStore.getState().gatewayOperation;
      if (requestId && current?.request_id !== requestId) {
        useGatewayStore.setState({ operationUncertain: true, operationError: 'La respuesta no corresponde a la operación pendiente. No se repetirá la solicitud.' });
        return null;
      }
      return current;
    }
    if (operation) {
      if (requestId) {
        if (!adoptLifecycleReceipt(operation, requestId)) {
          useGatewayStore.setState({ operationUncertain: true, operationError: 'La respuesta no corresponde a la operación pendiente. No se repetirá la solicitud.' });
          return null;
        }
      } else useGatewayStore.setState({ gatewayOperation: operation, operationUncertain: false, operationError: null });
      invalidateAvailability();
      await readAvailability();
    } else if (requestId) {
      // A request accepted late may not have a receipt yet. Never replay it.
      useGatewayStore.setState({ operationUncertain: true, operationError: 'El resultado todavía no se ha confirmado. Comprueba de nuevo antes de iniciar otra acción.' });
    }
    return operation;
  } catch (err) {
    if (gatewayAuthKey() === auth && operationEpoch === epoch) useGatewayStore.setState({ operationError: err instanceof Error ? err.message : 'No se pudo comprobar la operación' });
    return null;
  }
}
function runGatewayAction(action: GatewayOperation['action']): Promise<GatewayOperation | null> {
  const auth = gatewayAuthKey();
  if (operationFlight?.auth === auth) {
    if (operationFlight.action === action) return operationFlight.promise;
    useGatewayStore.setState({ operationError: 'Ya hay otra operación en curso. Comprueba su resultado antes de solicitar una acción distinta.' });
    return Promise.resolve(null);
  }
  const state = useGatewayStore.getState();
  if (state.gatewayOperation?.state === 'running' && state.gatewayOperation.action !== action) {
    useGatewayStore.setState({ operationError: 'Ya hay otra operación en curso. Comprueba su resultado antes de solicitar una acción distinta.' });
    return Promise.resolve(null);
  }
  if (state.gatewayOperation?.state === 'running' || state.operationUncertain) return reconcileGatewayOperation();
  const requestId = crypto.randomUUID();
  try { persistLifecycleMarker({ requestId, action }); } catch {
    useGatewayStore.setState({ operationUncertain: true, operationError: 'No se puede guardar el seguimiento en esta pestaña. No se ha enviado ninguna acción.' });
    return Promise.resolve(null);
  }
  operationEpoch += 1;
  const epoch = operationEpoch;
  invalidateAvailability();
  useGatewayStore.setState({ gatewayOperation: null, pendingGatewayRequestId: requestId, operationError: null, operationPermissionDenied: false, operationUncertain: false });
  const task = { auth, action, promise: Promise.resolve<GatewayOperation | null>(null) };
  operationFlight = task;
  task.promise = (async () => {
    try {
      const run = action === 'start' ? gw.startGateway : action === 'recover' ? gw.recoverGateway : action === 'stop' ? gw.stopGateway : gw.restartGateway;
      let operation = await run(requestId);
      if (gatewayAuthKey() !== auth || operationEpoch !== epoch) return null;
      if (!adoptLifecycleReceipt(operation, requestId)) {
        useGatewayStore.setState({ operationUncertain: true, operationError: 'La respuesta no corresponde a la operación pendiente. No se repetirá la solicitud.' });
        return null;
      }
      // Bounded observation, never a POST retry. Further progress is read-only.
      for (let attempt = 0; operation.state === 'running' && attempt < 4; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        if (gatewayAuthKey() !== auth || operationEpoch !== epoch) return null;
        const observed = await reconcileGatewayOperation();
        if (observed) operation = observed;
      }
      if (gatewayAuthKey() !== auth || operationEpoch !== epoch) return null;
      invalidateAvailability();
      await readAvailability();
      return operation;
    } catch (err) {
      if (gatewayAuthKey() !== auth || operationEpoch !== epoch) return null;
      if (err instanceof ApiError && err.status && err.status < 500 && err.status !== 408 && err.status !== 429) {
        if (err.status === 409 && err.code === 'GATEWAY_OPERATION_IN_PROGRESS') {
          try {
            // This POST was rejected; retain a local read-only watch for the
            // other operation, not a claim that our request was accepted.
            persistLifecycleMarker({ requestId, action, observingOther: true });
            useGatewayStore.setState({ operationUncertain: true, operationError: 'Otra operación de Gateway está en curso. Comprueba su resultado antes de iniciar otra.' });
            await reconcileGatewayOperation();
          } catch { useGatewayStore.setState({ operationUncertain: true, operationError: 'No se puede actualizar el seguimiento en esta pestaña.' }); }
        } else if (err.status === 409) {
          useGatewayStore.setState({ operationUncertain: true, operationError: err.message });
          await reconcileGatewayOperation();
        } else {
          try {
            persistLifecycleMarker(null);
            useGatewayStore.setState({ pendingGatewayRequestId: null, operationUncertain: false, operationError: err.message, operationPermissionDenied: err.status === 401 || err.status === 403 });
          } catch { useGatewayStore.setState({ operationUncertain: true, operationError: 'No se puede actualizar el seguimiento en esta pestaña.' }); }
        }
        await readAvailability();
        return null;
      }
      useGatewayStore.setState({ operationUncertain: true, operationError: err instanceof Error ? err.message : 'No se ha confirmado la operación' });
      return await reconcileGatewayOperation();
    } finally {
      if (operationFlight === task) operationFlight = null;
    }
  })();
  return task.promise;
}

export const useGatewayStore = create<GatewayStore>()((set) => ({
  configured: null,
  configuration: null,
  gatewayOperation: null, pendingGatewayRequestId: null, operationUncertain: false, operationError: null, operationPermissionDenied: false,
  modelsCheckedAt: null, channelsCheckedAt: null, sessionsCheckedAt: null,
  status: null,
  health: null,
  channels: [],
  channelsRuntime: null,
  models: [],
  sessions: [],
  usage: null,
  usageLoading: false,
  usageError: false,
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
  catalogProviders: [],
  installableProviders: [],
  catalogOpenclawVersion: null,
  catalogDegraded: false,
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
  removalOperation: null,
  checkRemovalOperation: () => checkModelRemoval(),

  fetchSnapshot: readAvailability,
  fetchStatus: readAvailability,
  fetchHealth: readAvailability,

  fetchChannels: async (observeRuntime = false) => {
    const sequence = ++inventoryReads.channels;
    const auth = gatewayAuthKey();
    const epoch = availabilityEpoch;
    set({ channelsLoading: true, channelsError: null });
    try {
      const { channels, runtime } = await gw.getChannels(observeRuntime);
      if (sequence !== inventoryReads.channels || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({ channels, ...(observeRuntime ? { channelsRuntime: runtime } : {}),
        channelsLoading: false, channelsCheckedAt: new Date().toISOString() });
    } catch (err) {
      if (sequence !== inventoryReads.channels || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({
        channelsError: err instanceof Error ? err.message : 'Failed to fetch channels',
        channelsLoading: false,
      });
    }
  },

  fetchModels: async () => {
    const sequence = ++inventoryReads.models;
    const auth = gatewayAuthKey();
    const epoch = availabilityEpoch;
    set({ modelsLoading: true, modelsError: null });
    try {
      const models = await gw.getModels();
      if (sequence !== inventoryReads.models || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({ models, modelsLoading: false, modelsCheckedAt: new Date().toISOString() });
    } catch (err) {
      if (sequence !== inventoryReads.models || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({
        modelsError: err instanceof Error ? err.message : 'Failed to fetch models',
        modelsLoading: false,
      });
    }
  },

  fetchSessions: async () => {
    const sequence = ++inventoryReads.sessions;
    const auth = gatewayAuthKey();
    const epoch = availabilityEpoch;
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await gw.getSessions();
      if (sequence !== inventoryReads.sessions || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({ sessions, sessionsLoading: false, sessionsCheckedAt: new Date().toISOString() });
    } catch (err) {
      if (sequence !== inventoryReads.sessions || auth !== gatewayAuthKey() || epoch !== availabilityEpoch) return;
      set({
        sessionsError: err instanceof Error ? err.message : 'Failed to fetch sessions',
        sessionsLoading: false,
      });
    }
  },

  fetchUsage: async () => {
    const sequence = ++inventoryReads.usage;
    const auth = gatewayAuthKey();
    const epoch = availabilityEpoch;
    set({ usageLoading: true, usageError: false });
    try {
      const usage = await gw.getUsage();
      if (sequence === inventoryReads.usage && auth === gatewayAuthKey() && epoch === availabilityEpoch)
        set({ usage, usageLoading: false, usageError: usage === null });
    } catch {
      if (sequence === inventoryReads.usage && auth === gatewayAuthKey() && epoch === availabilityEpoch)
        set({ usage: null, usageLoading: false, usageError: true });
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

  fetchCatalog: async (refresh = false) => {
    const sequence = ++inventoryReads.catalog;
    const auth = gatewayAuthKey();
    set({ catalogLoading: true, catalogError: null });
    try {
      const result = await gw.getModelCatalog(refresh);
      if (sequence !== inventoryReads.catalog || auth !== gatewayAuthKey()) return;
      const previous = useGatewayStore.getState().catalog;
      const previousConfigured = new Map(previous.map(model => [canonicalModelAddKey(model.key), model.configured] as const)
        .filter(([key]) => key !== null));
      const configurationChanged = previous.length > 0 && result.models.some(model => {
        const key = canonicalModelAddKey(model.key);
        return key !== null && previousConfigured.has(key) && previousConfigured.get(key) !== model.configured;
      });
      set({
        catalog: result.models,
        catalogProviders: result.providers,
        installableProviders: result.available_providers,
        catalogOpenclawVersion: result.openclaw_version,
        catalogDegraded: result.degraded,
        catalogLoading: false,
      });
      // Este catálogo se inició después de la confirmación y es la lectura
      // vigente de la sesión. Una discrepancia requiere consultar la fuente
      // autoritativa del recibo; nunca convierte ausencia en permiso de POST.
      for (const model of result.models) {
        if (!model.configured) useGatewayModelAddStore.getState().invalidateModelAddFromCatalog(model.key);
      }
      // Las vistas Configured y Catalog tienen lecturas distintas. Sólo una
      // variación aceptada de una clave ya conocida pide el refresco vecino;
      // fetchModels no vuelve a llamar al catálogo y no retrasa esta lectura.
      if (configurationChanged) void useGatewayStore.getState().fetchModels();
    } catch (err) {
      if (sequence !== inventoryReads.catalog || auth !== gatewayAuthKey()) return;
      set({ catalogError: err instanceof Error ? err.message : 'Failed to fetch catalog', catalogLoading: false });
    }
  },

  fetchProvidersOverview: async () => {
    const sequence = ++inventoryReads.providers;
    const auth = gatewayAuthKey();
    set({ providersOverviewLoading: true, providersOverviewError: null });
    try {
      const res = await gw.getProvidersOverview();
      if (sequence !== inventoryReads.providers || auth !== gatewayAuthKey()) return;
      set({ providersOverview: res.providers, catalogWarm: res.catalog_warm, providersOverviewLoading: false });
    } catch (err) {
      if (sequence !== inventoryReads.providers || auth !== gatewayAuthKey()) return;
      set({ providersOverviewError: err instanceof Error ? err.message : 'Failed to fetch providers overview', providersOverviewLoading: false });
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

  confirmModelAdd: (model: string) => {
    // No fetch that started before this confirmation may restore old data.
    inventoryReads.models += 1;
    inventoryReads.catalog += 1;
    inventoryReads.providers += 1;
    set((state) => ({
      catalog: state.catalog.map((item) => canonicalModelAddKey(item.key) === canonicalModelAddKey(model) ? { ...item, configured: true } : item),
      modelsLoading: false, catalogLoading: false, providersOverviewLoading: false,
    }));
    const store = useGatewayStore.getState();
    void Promise.all([store.fetchModels(), store.fetchCatalog(), store.fetchProvidersOverview()]);
  },

  addModel: (model: string) => useGatewayModelAddStore.getState().startModelAdd(model),

  // Borrado inmediato de UN modelo (sin cola/debounce) — lo usa el flujo de
  // borrado-de-disco de Ollama, donde el catálogo SÍ cambia y toca refetch.
  removeModel: async (model: string) => {
    const addition = findModelAddEntry(useGatewayModelAddStore.getState().modelAddOperations, model);
    if (addition?.state === 'running' || addition?.state === 'uncertain') throw new Error('Comprueba el resultado del alta antes de retirar este modelo.');
    const canonical = canonicalModelAddKey(model);
    if (!canonical || removalUnsettled.has(canonical)) throw new Error('La retirada anterior sigue sin confirmar.');
    set(state => ({ queuedRemovals: state.queuedRemovals.includes(model) ? state.queuedRemovals : [...state.queuedRemovals, model] }));
    await flushRemovals();
  },

  queueRemoveModel: (key: string) => {
    if (removalStorageInvalid) { toast.error('No se pueden leer las retiradas pendientes. Comprueba el almacenamiento del navegador.'); return; }
    const canonical = canonicalModelAddKey(key);
    if (!canonical) { toast.error('La identidad de este modelo es ambigua.'); return; }
    if (removalUnsettled.has(canonical)) { toast.error('La retirada de este modelo sigue sin confirmar.'); return; }
    const addition = findModelAddEntry(useGatewayModelAddStore.getState().modelAddOperations, key);
    if (addition?.state === 'running' || addition?.state === 'uncertain') {
      toast.error('Comprueba el resultado del alta antes de retirar este modelo.');
      return;
    }
    set((s) => (
      s.queuedRemovals.some(existing => canonicalModelAddKey(existing) === canonical) || s.inflightRemovals.some(existing => canonicalModelAddKey(existing) === canonical)
        ? s
        : { queuedRemovals: [...s.queuedRemovals, key] }
    ));
    scheduleRemovalFlush();
  },

  undoRemoveModel: (key: string) => {
    const canonical = canonicalModelAddKey(key);
    if (!canonical) return;
    const operation = useGatewayStore.getState().removalOperation;
    if (operation?.state === 'preparing' && !operation.requestId) {
      const remaining = operation.models.filter(model => canonicalModelAddKey(model) !== canonical);
      if (remaining.length !== operation.models.length) {
        removalUnsettled.delete(canonical);
        set({ removalOperation: remaining.length ? { ...operation, models: remaining } : null, inflightRemovals: remaining });
      }
    }
    set((state) => ({ queuedRemovals: state.queuedRemovals.filter(model => canonicalModelAddKey(model) !== canonical) }));
    if (!useGatewayStore.getState().removalOperation && useGatewayStore.getState().queuedRemovals.length) scheduleRemovalFlush();
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

  gatewayStart: () => runGatewayAction('start'),
  gatewayStop: () => runGatewayAction('stop'),
  gatewayRestart: () => runGatewayAction('restart'),
  gatewayRecover: () => runGatewayAction('recover'),
  checkGatewayOperation: reconcileGatewayOperation,
}));

configureModelAddHooks({
  beforeStart(model) {
    const state = useGatewayStore.getState();
    if (removalStorageInvalid) throw new Error('No se pueden comprobar las retiradas anteriores. Revisa el almacenamiento del navegador.');
    const canonical = canonicalModelAddKey(model);
    if (!canonical) throw new Error('La identidad de este modelo es ambigua.');
    if (state.inflightRemovals.some(key => canonicalModelAddKey(key) === canonical) || removalUnsettled.has(canonical)) throw new Error('La retirada de este modelo sigue sin confirmar. Comprueba su estado antes de añadirlo.');
    const queued = state.queuedRemovals.filter(key => canonicalModelAddKey(key) === canonical);
    if (queued.length) { queued.forEach(key => state.undoRemoveModel(key)); return 'handled'; }
    return 'start';
  },
  onSuccess(model) { useGatewayStore.getState().confirmModelAdd(model); },
});

useAuthStore.subscribe((state, previous) => {
  if (state.sessionGeneration === previous.sessionGeneration && state.isAuthenticated === previous.isAuthenticated && state.user?.id === previous.user?.id && state.user?.role === previous.user?.role) return;
  invalidateAvailability();
  operationEpoch += 1;
  operationFlight = null;
  const preparingRemoval = useGatewayStore.getState().removalOperation;
  if (preparingRemoval?.state === 'preparing' && !preparingRemoval.requestId)
    preparingRemoval.models.forEach(key => removalUnsettled.delete(canonicalModelAddKey(key) ?? key));
  removalEpoch++;
  if (removalFlushTimer) clearTimeout(removalFlushTimer);
  removalFlushTimer = null;
  inventoryReads.catalog++; inventoryReads.providers++;
  useGatewayStore.setState({
    configured: null, configuration: null, status: null, health: null,
    statusLoading: false, statusError: null,
    gatewayOperation: null, pendingGatewayRequestId: null, operationUncertain: false, operationError: null, operationPermissionDenied: false,
    channels: [], channelsRuntime: null, models: [], sessions: [], usage: null, providersOverview: null,
    usageLoading: false, usageError: false,
    catalog: [], catalogProviders: [], installableProviders: [], catalogLoading: false, catalogError: null,
    providersOverviewLoading: false, providersOverviewError: null, queuedRemovals: [], inflightRemovals: [],
    modelsCheckedAt: null, channelsCheckedAt: null, sessionsCheckedAt: null,
    channelsLoading: false, modelsLoading: false, sessionsLoading: false,
  });
  resumeRemoval();
  resumeLifecycleOperation();
});
queueMicrotask(resumeRemoval);
queueMicrotask(resumeLifecycleOperation);

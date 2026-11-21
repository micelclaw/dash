import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import { readModelAddOperation, startModelAddOperation, type ModelAddReceipt } from '@/services/gateway.service';
import { ApiError } from '@/services/api';

type AddState = 'running' | 'uncertain' | 'succeeded' | 'failed';
type AddKind = 'add' | 'add-with-config';
export type ModelAddEntry = { model: string; requestId: string; canonicalId?: string; needsCurrentReadback?: boolean; canReconcile?: boolean; credentialAcknowledged?: boolean; kind: AddKind; state: AddState; message?: string; errorCode?: string };
type Identity = { userId: string; generation: number; role: string };
type AddCustom = { provider_id: string; model_id: string; name: string };
interface ModelAddStore {
  modelAddOperations: Record<string, ModelAddEntry>;
  startModelAdd: (model: string, custom?: AddCustom) => Promise<void>;
  checkModelAdd: (model: string) => Promise<void>;
  resumeModelAdds: () => void;
  forgetModelAdd: (model: string) => boolean;
  invalidateModelAddFromCatalog: (model: string) => void;
}
/** Misma normalización de claves que el Gateway; identidades ambiguas se
 * rechazan en el alta, no se adivinan como otro modelo. */
export function canonicalModelAddKey(value: string): string | null {
  const match = /^([\w.-]+)\/([\w.:/-]+)$/.exec(value);
  if (!match) return null;
  const provider = match[1]!;
  let rest = match[2]!;
  if (rest.startsWith(`${provider}/`)) rest = rest.slice(provider.length + 1);
  if (!rest || rest.startsWith(`${provider}/`) || rest.startsWith('/') || rest.endsWith('/') || rest.includes('//')) return null;
  return `${provider}/${rest}`;
}
export function findModelAddEntry(operations: Record<string, ModelAddEntry>, model: string): ModelAddEntry | undefined {
  const id = canonicalModelAddKey(model);
  if (!id) return undefined;
  return Object.values(operations).find(entry => canonicalModelAddKey(entry.model) === id);
}
type AddHooks = { beforeStart(model: string): 'start' | 'handled'; onSuccess(model: string): void };
let hooks: AddHooks = { beforeStart: () => 'start', onSuccess: () => {} };
export function configureModelAddHooks(next: AddHooks) { hooks = next; }
const identity = (): Identity | null => {
  const session = useAuthStore.getState();
  return session.isAuthenticated && session.user ? { userId: session.user.id, generation: session.sessionGeneration, role: session.user.role } : null;
};
const key = (userId: string) => `micelclaw-model-add:${userId}`;
const live = (expected: Identity, serial: number) => {
  const now = identity();
  return serial === epoch && now?.userId === expected.userId && now.generation === expected.generation && now.role === expected.role;
};
const messages: Record<string, string> = {
  CREDENTIAL_REQUIRED: 'Necesitas conectar la cuenta del proveedor antes de añadir este modelo.',
  MODEL_UNAVAILABLE: 'El proveedor no ha podido comprobar este modelo. Revisa su disponibilidad.',
  CONFIG_CHANGED: 'La configuración cambió durante la comprobación. Vuelve a intentarlo.',
  ACCESS_DENIED: 'Ya no tienes permiso para añadir este modelo.',
  FAILED: 'No se pudo añadir el modelo. Comprueba el proveedor y vuelve a intentarlo.',
  RETRY_AVAILABLE: 'La operación anterior terminó. Puedes volver a pulsar Añadir.',
};
const uncertain = 'No se ha podido confirmar el resultado. Compruébalo antes de repetir el alta.';
let epoch = 0;
let owner: Identity | null = null;
let entries: Record<string, ModelAddEntry> = {};
let storageInvalid = false;
const activeReads = new Map<string, number>();
const notified = new Set<string>();
function save(next: Record<string, ModelAddEntry>) {
  if (!owner) throw new Error('No hay una sesión para seguir esta operación.');
  // Nunca guardar credenciales ni datos de configuración. Antes del POST es
  // obligatorio haber podido guardar el identificador para una recarga segura.
  const saved = Object.fromEntries(Object.entries(next).filter(([, entry]) => entry.requestId));
  sessionStorage.setItem(key(owner.userId), JSON.stringify(saved));
}
function publish(next: Record<string, ModelAddEntry>, requiredStorage = false) {
  if (requiredStorage) save(next);
  else try { save(next); } catch { /* Mantiene el intento previo recuperable. */ }
  entries = next;
  useGatewayModelAddStore.setState({ modelAddOperations: { ...next } });
}
function merge(model: string, entry: ModelAddEntry, requiredStorage = false) { publish({ ...entries, [model]: entry }, requiredStorage); }
function asReceipt(entry: ModelAddEntry, receipt: ModelAddReceipt | null, current?: 'present' | 'unknown' | null): ModelAddEntry {
  if (!receipt || receipt.model !== entry.model || receipt.kind !== entry.kind || typeof receipt.id !== 'string'
    || !/^\d{13}\.[a-f0-9-]{36}$/i.test(receipt.id) || entry.canonicalId && entry.canonicalId !== receipt.id) return { ...entry, state: 'uncertain', message: uncertain };
  entry = { ...entry, canonicalId: receipt.id };
  if (receipt.state === 'succeeded') {
    // Un recibo anterior a la recarga sólo acredita que entonces se guardó.
    // Después pudo retirarse desde otra pestaña o por otro usuario.
    if (current !== 'present') return { ...entry, state: 'uncertain', message: 'El alta terminó anteriormente; falta confirmar el estado actual del modelo.', needsCurrentReadback: true };
    return { ...entry, state: 'succeeded', message: undefined, errorCode: undefined, needsCurrentReadback: undefined };
  }
  if (receipt.state === 'failed') return { ...entry, state: 'failed', message: messages[receipt.code ?? 'FAILED'] ?? messages.FAILED, errorCode: receipt.code };
  if (receipt.state === 'uncertain') return { ...entry, state: 'uncertain', errorCode: receipt.code,
    canReconcile: receipt.can_reconcile !== false, message: receipt.can_reconcile === false
      ? 'No se puede confirmar este resultado. Revisa los modelos configurados o contacta con un administrador.'
      : receipt.code === 'MODEL_OPERATION_MODEL_BUSY' ? 'Hay otra operación pendiente. Comprueba cuándo termina antes de volver a añadir.' : uncertain };
  if (receipt.state === 'queued' || receipt.state === 'checking') return { ...entry, state: 'running', message: 'Añadiendo…' };
  return { ...entry, state: 'uncertain', message: uncertain };
}
function success(entry: ModelAddEntry) {
  const k = `${owner?.userId ?? ''}\0${entry.requestId}`;
  if (notified.has(k)) return;
  notified.add(k); hooks.onSuccess(entry.model);
}
async function poll(model: string, expected: Identity, serial: number) {
  if (activeReads.get(model) === serial) return;
  activeReads.set(model, serial);
  try {
    for (let i = 0; i < 15 && live(expected, serial); i++) {
      const previous = entries[model];
      if (!previous || !previous.requestId || previous.state === 'succeeded' || previous.state === 'failed') return;
      try {
        const result = await readModelAddOperation(previous.requestId);
        if (!live(expected, serial) || entries[model]?.requestId !== previous.requestId) return;
        const next = asReceipt(previous, result?.operation ?? null, result?.current);
        merge(model, next);
        if (next.state === 'succeeded') { success(next); return; }
        if (next.state !== 'running') return;
      } catch {
        if (live(expected, serial) && entries[model]?.requestId === previous.requestId) merge(model, { ...previous, state: 'uncertain', message: uncertain });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    const current = entries[model];
    if (live(expected, serial) && current?.state === 'running') merge(model, { ...current, state: 'uncertain', message: 'La operación sigue pendiente. Comprueba el resultado.' });
  } finally { if (activeReads.get(model) === serial) activeReads.delete(model); }
}
function resume() {
  const nextOwner = identity();
  epoch++; activeReads.clear(); notified.clear(); owner = nextOwner; entries = {}; storageInvalid = false;
  if (!nextOwner) { useGatewayModelAddStore.setState({ modelAddOperations: {} }); return; }
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key(nextOwner.userId)) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid');
    for (const [model, value] of Object.entries(raw)) {
      const entry = value as ModelAddEntry;
      if (!entry || entry.model !== model || typeof entry.requestId !== 'string' || !/^\d{13}\.[a-f0-9-]{36}$/i.test(entry.requestId)
        || entry.canonicalId !== undefined && (typeof entry.canonicalId !== 'string' || !/^\d{13}\.[a-f0-9-]{36}$/i.test(entry.canonicalId))
        || !['running','uncertain','succeeded','failed'].includes(entry.state) || !['add','add-with-config'].includes(entry.kind)) throw new Error('invalid');
      if (!canonicalModelAddKey(model) || findModelAddEntry(entries, model)) throw new Error('invalid');
      entries[model] = entry.state === 'failed' ? entry : {
        ...entry, state: entry.state === 'succeeded' ? 'uncertain' : entry.state,
        needsCurrentReadback: true,
        ...(entry.state === 'succeeded' ? { message: 'El alta terminó anteriormente; falta confirmar el estado actual del modelo.' } : {}),
      };
    }
  } catch { storageInvalid = true; entries = {}; }
  useGatewayModelAddStore.setState({ modelAddOperations: { ...entries } });
  const serial = epoch;
  for (const [model, entry] of Object.entries(entries)) {
    if ((entry.state === 'running' || entry.state === 'uncertain') && entry.canReconcile !== false && (entry.errorCode !== 'MODEL_OPERATION_MODEL_BUSY' || !!entry.canonicalId)) void poll(model, nextOwner, serial);
  }
}
export const useGatewayModelAddStore = create<ModelAddStore>()(() => ({
  modelAddOperations: {},
  resumeModelAdds: resume,
  async startModelAdd(model, custom) {
    const expected = identity();
    if (!expected || !owner || owner.userId !== expected.userId || owner.generation !== expected.generation || owner.role !== expected.role) throw new Error('Necesitas una sesión activa para añadir el modelo.');
    if (storageInvalid) throw new Error('No se puede seguir el resultado de las altas guardadas. Comprueba el almacenamiento del navegador.');
    const canonical = canonicalModelAddKey(model);
    if (!canonical) throw new Error('La identidad de este modelo es ambigua. Revisa el proveedor y el nombre antes de añadirlo.');
    const previous = findModelAddEntry(entries, model);
    if (previous && (previous.state !== 'failed' || previous.errorCode === 'CREDENTIAL_REQUIRED' || previous.errorCode === 'ACCESS_DENIED')) return;
    if (hooks.beforeStart(model) === 'handled') return;
    if (previous && previous.model !== model) { const next = { ...entries }; delete next[previous.model]; entries = next; }
    const serial = epoch;
    const initial: ModelAddEntry = { model, requestId: '', kind: custom ? 'add-with-config' : 'add', state: 'running', message: 'Añadiendo…' };
    // Reserva síncrona: dos clics del mismo turno nunca disparan dos relojes/POST.
    entries = { ...entries, [model]: initial };
    useGatewayModelAddStore.setState({ modelAddOperations: { ...entries } });
    let entry = initial;
    try {
      const clock = await readModelAddOperation();
      if (!live(expected, serial) || entries[model] !== initial) return;
      if (!Number.isSafeInteger(clock?.server_time_ms) || String(clock.server_time_ms).length !== 13) throw new Error('MODEL_ADD_CLOCK_INVALID');
      entry = { ...initial, requestId: `${clock.server_time_ms}.${crypto.randomUUID()}` };
      merge(model, entry, true);
    } catch (error) {
      if (live(expected, serial) && entries[model] === initial) {
        const access = error instanceof ApiError && (error.status === 401 || error.status === 403);
        const message = access ? (error.status === 401 ? 'Tu sesión ha caducado. Inicia sesión y vuelve a comprobar tus permisos.' : 'No tienes permiso para administrar modelos. Solicita acceso a un administrador.')
          : 'No se pudo preparar el seguimiento del alta. No se ha enviado ningún cambio.';
        merge(model, { ...initial, state: 'failed', message, ...(access ? { errorCode: 'ACCESS_DENIED' } : {}) });
      }
      return;
    }
    try {
      const receipt = await startModelAddOperation(model, entry.requestId, custom);
      if (!live(expected, serial) || entries[model]?.requestId !== entry.requestId) return;
      const next = asReceipt(entry, receipt); merge(model, next);
      if (next.state === 'succeeded') success(next);
      else if (next.state === 'running' || receipt?.state === 'succeeded') void poll(model, expected, serial);
    } catch (error) {
      if (!live(expected, serial) || entries[model]?.requestId !== entry.requestId) return;
      if (error instanceof ApiError && error.status === 409 && error.code === 'MODEL_OPERATION_MODEL_BUSY') {
        // El identificador rechazado NO es un recibo consultable. Podría ser
        // una operación de otra sesión o actor que aún no ha terminado.
        merge(model, { ...entry, state: 'uncertain', errorCode: 'MODEL_OPERATION_MODEL_BUSY',
          message: 'Hay otra operación anterior sin confirmar. Espera o contacta con un administrador.' });
        return;
      }
      // Sólo las negativas conocidas del handler anteriores a la reserva son
      // definitivas. Un conflicto con otra operación no habilita el reenvío.
      const beforeReservation = new Set([
        'MODEL_ADD_REQUEST_INVALID', 'MODEL_OPERATION_INTENT_INVALID', 'MODEL_OPERATION_PAYLOAD_INVALID',
        'MODEL_OPERATION_ID_INVALID', 'MODEL_OPERATION_ID_EXPIRED', 'UNAUTHORIZED', 'FORBIDDEN',
        'PROVIDER_NOT_AUTHENTICATED', 'CREDENTIAL_REQUIRED',
      ]);
      if (error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500
        && error.status !== 408 && error.status !== 429 && beforeReservation.has(error.code)) {
        const code = error.code === 'PROVIDER_NOT_AUTHENTICATED' || error.code === 'CREDENTIAL_REQUIRED' ? 'CREDENTIAL_REQUIRED'
          : error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN' ? 'ACCESS_DENIED' : 'FAILED';
        merge(model, { ...entry, state: 'failed', message: messages[code], errorCode: code });
        return;
      }
      merge(model, { ...entry, state: 'uncertain', message: 'Comprobando resultado…' });
      void poll(model, expected, serial);
    }
  },
  async checkModelAdd(model) {
    const expected = identity(), entry = findModelAddEntry(entries, model), serial = epoch;
    if (!expected || !entry || entry.canReconcile === false || (entry.errorCode === 'MODEL_OPERATION_MODEL_BUSY' && !entry.canonicalId)) return;
    model = entry.model;
    if (entry.state === 'failed' && entry.errorCode === 'CREDENTIAL_REQUIRED') {
      // El usuario indica que ya conectó su cuenta; no inventamos una
      // comprobación de credenciales ni enviamos el alta automáticamente.
      // Un nuevo clic en Añadir vuelve a pasar el gate real de Core.
      merge(model, { ...entry, errorCode: undefined, credentialAcknowledged: true,
        message: 'Si ya conectaste la cuenta, pulsa Añadir. Se comprobará antes de guardar.' });
      return;
    }
    if (entry.state === 'failed' && entry.errorCode === 'ACCESS_DENIED') {
      try {
        await readModelAddOperation();
        if (live(expected, serial) && entries[model] === entry) useGatewayModelAddStore.getState().forgetModelAdd(model);
      } catch { /* La sesión sigue sin acreditar permiso. No se envía ningún alta. */ }
      return;
    }
    await poll(model, expected, serial);
  },
  forgetModelAdd(model) {
    const entry = findModelAddEntry(entries, model); if (!entry) return true;
    if (entry.state === 'running' || entry.state === 'uncertain') return false;
    const next = { ...entries }; delete next[entry.model];
    try { publish(next, true); return true; } catch { return false; }
  },
  invalidateModelAddFromCatalog(model) {
    const expected = identity(), entry = findModelAddEntry(entries, model), serial = epoch;
    if (!expected || !entry || entry.state !== 'succeeded') return;
    const next: ModelAddEntry = { ...entry, state: 'uncertain', needsCurrentReadback: true,
      message: 'El catálogo cambió; se comprobará el estado actual antes de añadir de nuevo.' };
    merge(entry.model, next);
    void poll(entry.model, expected, serial);
  },
}));
useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration !== previous.sessionGeneration || next.user?.id !== previous.user?.id || next.user?.role !== previous.user?.role || next.isAuthenticated !== previous.isAuthenticated) resume();
});
queueMicrotask(resume);

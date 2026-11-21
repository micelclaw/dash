import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import { readConfigRepair, startConfigRepair, type ConfigRepairOperation } from '@/services/gateway-config-repair.service';

interface RepairState {
  operation: ConfigRepairOperation | null;
  pendingId: string | null;
  loading: boolean;
  error: string | null;
  start: () => Promise<void>;
  check: () => Promise<void>;
  resume: () => Promise<void>;
}
type Identity = { id: string; generation: number; role: string };
const identity = (): Identity | null => {
  const session = useAuthStore.getState();
  return session.user && session.isAuthenticated ? { id: session.user.id, generation: session.sessionGeneration, role: session.user.role } : null;
};
const current = (expected: Identity) => {
  const now = identity(); return now?.id === expected.id && now.generation === expected.generation && now.role === expected.role;
};
const storageKey = (id: string) => `micelclaw-config-repair:${id}`;
const unresolved = (operation: ConfigRepairOperation) => operation.state === 'running' || operation.state === 'uncertain';
let mutation: { identity: Identity; promise: Promise<void> } | null = null;
let reading: { identity: Identity; promise: Promise<void> } | null = null;
let monitoring = 0;

export const useGatewayConfigRepairStore = create<RepairState>()((set, get) => {
  const accept = (expected: Identity, operation: ConfigRepairOperation) => {
    if (!current(expected)) return;
    const pendingId = unresolved(operation) ? operation.request_id : null;
    set({ operation, pendingId, error: null });
    try { if (pendingId) sessionStorage.setItem(storageKey(expected.id), pendingId); else sessionStorage.removeItem(storageKey(expected.id)); }
    catch { /* The previously persisted attempt still prevents a blind replay. */ }
  };
  const check = (): Promise<void> => {
    const expected = identity(), id = get().pendingId;
    if (!expected || !id) return Promise.resolve();
    if (reading && current(reading.identity)) return reading.promise;
    const task = { identity: expected, promise: Promise.resolve() };
    task.promise = (async () => {
      set({ loading: true });
      try {
        const operation = await readConfigRepair(id);
        if (!current(expected) || get().pendingId !== id) return;
        if (operation) accept(expected, operation);
        else set({ error: 'No se encontró el recibo de este intento. Su resultado sigue sin confirmar; revisa la configuración antes de iniciar otro.' });
      } catch {
        if (current(expected) && get().pendingId === id) set({ error: 'No se pudo consultar el resultado. Comprueba la conexión y pulsa «Consultar resultado»; no se enviará otra reparación.' });
      } finally { if (reading === task) reading = null; if (current(expected) && (get().pendingId === id || !get().pendingId)) set({ loading: false }); }
    })();
    reading = task; return task.promise;
  };
  const monitor = async (expected: Identity) => {
    const epoch = ++monitoring;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!current(expected) || epoch !== monitoring || get().operation?.state !== 'running') return;
      await new Promise(resolve => setTimeout(resolve, 1_500));
      if (!current(expected) || epoch !== monitoring) return;
      await check();
    }
  };
  return {
    operation: null, pendingId: null, loading: false, error: null,
    check,
    resume: async () => {
      const expected = identity(); if (!expected) return;
      let pendingId: string | null = null;
      try { pendingId = sessionStorage.getItem(storageKey(expected.id)); } catch { /* no pending durable receipt */ }
      if (pendingId && /^[a-f0-9-]{36}$/i.test(pendingId)) {
        set({ pendingId }); await check(); if (current(expected)) void monitor(expected);
      }
    },
    start: () => {
      const expected = identity(); if (!expected) return Promise.resolve();
      if (mutation && current(mutation.identity)) return mutation.promise;
      if (get().pendingId) return check();
      const requestId = crypto.randomUUID();
      try { sessionStorage.setItem(storageKey(expected.id), requestId); }
      catch { set({ error: 'No se pudo preparar el seguimiento de la reparación. Recarga la página antes de intentarlo; no se ha enviado ningún cambio.' }); return Promise.resolve(); }
      set({ pendingId: requestId, loading: true, error: null, operation: null });
      const task = { identity: expected, promise: Promise.resolve() };
      task.promise = (async () => {
        try {
          const operation = await startConfigRepair(requestId);
          if (get().pendingId === requestId) accept(expected, operation);
        }
        catch {
          if (current(expected)) {
            set({ error: 'La respuesta no se pudo confirmar. Se consultará el mismo intento; no se repetirá la escritura.' });
            await check();
          }
        } finally { if (mutation === task) { mutation = null; if (current(expected)) set({ loading: false }); } }
        if (current(expected)) void monitor(expected);
      })();
      mutation = task; return task.promise;
    },
  };
});

useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration !== previous.sessionGeneration || next.user?.id !== previous.user?.id || next.user?.role !== previous.user?.role) {
    monitoring++; reading = null; mutation = null;
    useGatewayConfigRepairStore.setState({ operation: null, pendingId: null, loading: false, error: null });
  }
});

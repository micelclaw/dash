import type { Params } from './types';

/** The child talks only to its native sandbox parent. It has no API or storage access. */
export function createAppClient(target: Window, parent: Window) {
 let closed = false; let sequence = 0;
 const waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; cleanup(): void }>();
 const listeners = new Set<(method: string, params: Params) => void>();
 const send = (message: Params) => parent.postMessage({ jsonrpc: '2.0', ...message }, '*'); // Native inner sandbox may have opaque origin.
 const onMessage = (event: MessageEvent) => {
  if (closed || event.source !== parent || !event.data || event.data.jsonrpc !== '2.0') return;
  const { id, result, error, method, params } = event.data;
  if (typeof method !== 'string' && ('result' in event.data || 'error' in event.data) && Number.isSafeInteger(id) && waiting.has(id)) {
   const item = waiting.get(id)!; waiting.delete(id); item.cleanup();
   if (error) item.reject(new Error('El host no pudo completar la operación. Revisa el acceso o la aprobación pendiente.'));
   else item.resolve(result);
  } else if (typeof method === 'string') for (const listener of listeners) listener(method, params && typeof params === 'object' ? params : {});
 };
 target.addEventListener('message', onMessage);
 return {
  rpc(method: string, params: Params, signal?: AbortSignal): Promise<unknown> {
   if (closed || signal?.aborted) return Promise.reject(new Error('La vista ya no está activa.'));
   const id = ++sequence;
   return new Promise((resolve, reject) => {
    const cancel = () => { if (!waiting.delete(id)) return; clearTimeout(timer); signal?.removeEventListener('abort', cancel); send({ method: 'notifications/cancelled', params: { requestId: id } }); reject(new Error('La consulta se ha cancelado.')); };
    const timer = setTimeout(cancel, 95_000);
    waiting.set(id, { resolve, reject, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); } });
    signal?.addEventListener('abort', cancel, { once: true }); send({ id, method, params });
   });
  },
  notify(method: string, params: Params = {}) { if (!closed) send({ method, params }); },
  subscribe(listener: (method: string, params: Params) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  close() { closed = true; target.removeEventListener('message', onMessage); for (const item of waiting.values()) { item.cleanup(); item.reject(new Error('La vista se ha cerrado.')); } waiting.clear(); listeners.clear(); },
 };
}

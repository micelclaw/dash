import { useEffect, useLayoutEffect, useRef } from 'react';
import { subscribeOriginRefresh, syncAffectsDomain } from '@/lib/origin-refresh';
import { useWebSocketStore } from '@/stores/websocket.store';

/** Coalesce bursts and refresh only mounted consumers of the affected domains. */
export function useOriginRefresh(domain: string, refresh: () => unknown, connectorIds?: string[]) {
  const callback = useRef(refresh);
  const ids = useRef(connectorIds);
  useLayoutEffect(() => { callback.current = refresh; ids.current = connectorIds; }, [refresh, connectorIds]);
  useEffect(() => {
    const domains = domain.split(',');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed) void Promise.resolve(callback.current()).catch(() => {});
      }, 200);
    };
    const unsubscribe = subscribeOriginRefresh(signal => {
      if (signal.domains && !domains.some(d => signal.domains!.includes(d))) return;
      if (signal.connectorId && ids.current?.length && !ids.current.includes(signal.connectorId)) return;
      schedule();
    });
    const ws = useWebSocketStore.subscribe((state, prev) => {
      if (state.status === 'connected' && prev.status !== 'connected') schedule();
      const event = state.lastEvent;
      if (event !== prev.lastEvent && event?.event === 'note.invalidated' && domains.includes('notes')) schedule();
      if (event !== prev.lastEvent && event?.event === 'sync.completed'
        && syncAffectsDomain(event.data, domains, ids.current)) schedule();
    });
    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    return () => {
      disposed = true; clearTimeout(timer); unsubscribe(); ws();
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
    };
  }, [domain]);
}

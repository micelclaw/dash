import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';

const MAX_RECOVERY_ATTEMPTS = 3;

/** Shell session lifetime. A successful HTTP refresh, including an identical
 * JWT, permits a new attempt; a transient failure never retries that rejected
 * credential immediately. All async work belongs to this session generation. */
export function startCoreWebSocketSession(): () => void {
  const initial = useAuthStore.getState();
  if (!initial.isAuthenticated || !initial.tokens?.accessToken) return () => {};
  const generation = initial.sessionGeneration;
  let cancelled = false;
  let refreshing = false;
  let attempts = 0;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let ownedClient = useWebSocketStore.getState().client;
  const current = () => !cancelled && useAuthStore.getState().sessionGeneration === generation
    && useAuthStore.getState().isAuthenticated;
  const clearTimers = () => {
    if (recoveryTimer !== null) clearTimeout(recoveryTimer);
    if (stableTimer !== null) clearTimeout(stableTimer);
    recoveryTimer = stableTimer = null;
  };
  const retire = () => {
    cancelled = true;
    clearTimers();
    if (useWebSocketStore.getState().client === ownedClient) useWebSocketStore.getState().disconnect();
  };
  const connect = () => {
    if (!current()) return;
    const token = useAuthStore.getState().tokens?.accessToken;
    if (!token) return;
    useWebSocketStore.getState().connect(token);
    ownedClient = useWebSocketStore.getState().client;
  };
  const recover = async (initialAttempt = false): Promise<void> => {
    if (!current() || refreshing || (!initialAttempt && attempts >= MAX_RECOVERY_ATTEMPTS)) return;
    refreshing = true;
    if (!initialAttempt) attempts++;
    try {
      const result = await useAuthStore.getState().refresh();
      if (!current()) return;
      if (result.status === 'refreshed' || (initialAttempt && (result.status === 'transient' || result.status === 'unavailable'))) {
        connect();
      } else if (result.status === 'transient' && attempts < MAX_RECOVERY_ATTEMPTS) {
        recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          void recover();
        }, 1000 * 2 ** (attempts - 1));
      }
    } finally {
      refreshing = false;
    }
  };
  const unsubAuth = useAuthStore.subscribe((state, previous) => {
    if (!current()) { retire(); return; }
    if (state.tokens !== previous.tokens && !refreshing) {
      clearTimers();
      attempts = 0;
      connect();
    }
  });
  const unsubWs = useWebSocketStore.subscribe((state, previous) => {
    if (!current() || state.status === previous.status) return;
    if (stableTimer !== null) clearTimeout(stableTimer);
    stableTimer = null;
    if (state.status === 'auth_failed') {
      // Defer until this client has finished its close callback. Deduplicate
      // status notifications and let a pending refresh finish before recovery.
      if (recoveryTimer === null) recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        void recover();
      }, 0);
    } else if (state.status === 'connected') {
      // onopen precedes Core authentication; immediate 4401 must retain the
      // bound. A stable connection starts a new future recovery episode.
      stableTimer = setTimeout(() => { if (current()) attempts = 0; stableTimer = null; }, 30_000);
    }
  });
  void recover(true);
  return () => { retire(); unsubAuth(); unsubWs(); };
}

export function useCoreWebSocket(): void {
  const generation = useAuthStore((state) => state.sessionGeneration);
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  useEffect(startCoreWebSocketSession, [generation, userId, authenticated]);
}

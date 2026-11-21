import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useUiPreferencesStore } from '@/stores/ui-preferences.store';
import { useWebSocketStore } from '@/stores/websocket.store';

/** The server sends a separate value-free notice to each authorized recipient. */
export function subscribeConfigurationChanges(): () => void {
  const actor = useAuthStore.getState(); const userId = actor.user?.id; const generation = actor.sessionGeneration;
  const client = useWebSocketStore.getState().client;
  if (!userId || !actor.isAuthenticated || !client) return () => undefined;
  let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !disposed && useAuthStore.getState().isAuthenticated && useAuthStore.getState().user?.id === userId
    && useAuthStore.getState().sessionGeneration === generation && useWebSocketStore.getState().client === client;
  const unsubscribe = client.on('configuration.changed', frame => {
    if (!current() || frame.data.user_id !== userId || !['personal', 'instance'].includes(frame.data.scope as string)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (current()) void Promise.allSettled([useSettingsStore.getState().fetchSettings(), useUiPreferencesStore.getState().refresh()]);
    }, 150);
  });
  return () => { disposed = true; clearTimeout(timer); unsubscribe(); };
}

export function useConfigurationChanges() {
  const client = useWebSocketStore(state => state.client);
  const userId = useAuthStore(state => state.user?.id);
  const generation = useAuthStore(state => state.sessionGeneration);
  useEffect(subscribeConfigurationChanges, [client, userId, generation]);
}

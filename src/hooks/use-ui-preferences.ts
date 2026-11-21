import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { activateUiPreferences } from '@/stores/ui-preferences.store';

export function useSynchronizedUiPreferences() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const sessionGeneration = useAuthStore(state => state.sessionGeneration);
  useEffect(() => activateUiPreferences(userId), [userId, sessionGeneration]);
}

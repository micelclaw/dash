import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useConfigurationAvailabilityStore } from '@/stores/configuration-availability.store';

export function useConfigurationAvailabilityState() {
  const userId = useAuthStore(state => state.user?.id);
  const sessionGeneration = useAuthStore(state => state.sessionGeneration);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const availability = useConfigurationAvailabilityStore();
  const key = authenticated && userId ? `${userId}:${sessionGeneration}` : null;
  const status = availability.sessionKey === key ? availability.status : 'checking';
  return { status, available: status === 'available', check: availability.check };
}

/** Settings owns the probe; the direct section observes the same session-bound state. */
export function useConfigurationAvailability() {
  const userId = useAuthStore(state => state.user?.id);
  const sessionGeneration = useAuthStore(state => state.sessionGeneration);
  const availability = useConfigurationAvailabilityState();
  useEffect(() => {
    const check = () => { void useConfigurationAvailabilityStore.getState().check(); };
    check();
    const interval = setInterval(check, 30_000);
    window.addEventListener('focus', check);
    return () => { clearInterval(interval); window.removeEventListener('focus', check); };
  }, [userId, sessionGeneration]);
  return availability;
}

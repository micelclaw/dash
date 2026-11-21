import { create } from 'zustand';
import { ApiError } from '@/services/api';
import { configurationApi } from '@/services/configuration.service';
import { useAuthStore } from './auth.store';

export type ConfigurationAvailability = 'checking' | 'available' | 'unavailable' | 'forbidden' | 'error';
interface AvailabilityState {
  sessionKey: string | null;
  status: ConfigurationAvailability;
  check(): Promise<void>;
}
let pending: { key: string; work: Promise<void>; token: symbol } | undefined;
export function configurationAvailabilitySessionKey(): string | null {
  const { user, sessionGeneration, isAuthenticated } = useAuthStore.getState();
  return isAuthenticated && user?.id ? `${user.id}:${sessionGeneration}` : null;
}

export const useConfigurationAvailabilityStore = create<AvailabilityState>((set, get) => ({
  sessionKey: null, status: 'checking',
  check: async () => {
    const key = configurationAvailabilitySessionKey();
    if (!key) { set({ sessionKey: null, status: 'checking' }); return; }
    if (pending?.key === key) return pending.work;
    const previous = get();
    set({ sessionKey: key, status: previous.sessionKey === key && previous.status === 'available' ? 'available' : 'checking' });
    const token = Symbol();
    const work = Promise.resolve().then(async () => {
      try {
        const catalog = await configurationApi.catalog('personal');
        if (configurationAvailabilitySessionKey() !== key) return;
        const valid = catalog?.format_version === 1 && Array.isArray(catalog.blocks) && catalog.blocks.every(block => typeof block.id === 'string' && typeof block.label === 'string' && typeof block.authorized === 'boolean' && typeof block.available === 'boolean')
          && typeof catalog.coverage?.complete === 'boolean' && Array.isArray(catalog.coverage.issues) && catalog.coverage.issues.every(issue => typeof issue === 'string');
        set({ sessionKey: key, status: valid ? 'available' : 'unavailable' });
      } catch (error) {
        if (configurationAvailabilitySessionKey() !== key) return;
        const status: ConfigurationAvailability = error instanceof ApiError && (error.status === 404 || error.status === 503) ? 'unavailable'
          : error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error';
        set({ sessionKey: key, status });
      } finally { if (pending?.token === token) pending = undefined; }
    });
    pending = { key, work, token }; await work;
  },
}));

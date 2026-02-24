import { create } from 'zustand';
import type { InstalledApp, AppsListResponse } from '@/types/apps';
import { getInstalledApps, type AppsFilters } from '@/services/apps.service';

interface RestartState {
  openclaw: boolean;
  core: boolean;
  reason?: string;
}

interface AppsStore {
  installedApps: InstalledApp[];
  meta: AppsListResponse['meta'] | null;
  loading: boolean;
  error: string | null;
  restartRequired: RestartState;
  fetchInstalledApps: (filters?: AppsFilters) => Promise<void>;
  setRestartRequired: (type: 'openclaw' | 'core', reason?: string) => void;
  clearRestart: (type: 'openclaw' | 'core') => void;
}

export const useAppsStore = create<AppsStore>()((set) => ({
  installedApps: [],
  meta: null,
  loading: false,
  error: null,
  restartRequired: { openclaw: false, core: false },

  fetchInstalledApps: async (filters?: AppsFilters) => {
    set({ loading: true, error: null });
    try {
      const res = await getInstalledApps(filters);
      set({ installedApps: res.data, meta: res.meta, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load apps',
        loading: false,
      });
    }
  },

  setRestartRequired: (type, reason) =>
    set((s) => ({
      restartRequired: { ...s.restartRequired, [type]: true, reason },
    })),

  clearRestart: (type) =>
    set((s) => ({
      restartRequired: { ...s.restartRequired, [type]: false, reason: undefined },
    })),
}));

/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

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

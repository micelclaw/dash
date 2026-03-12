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
import { api } from '@/services/api';

// ─── Types ───────────────────────────────────────────────

export type ServiceState = 'stopped' | 'starting' | 'running' | 'draining' | 'failed';
export type LifecyclePolicy = 'always' | 'ondemand' | 'scheduled';
export type HardwareProfileTier = 'lite' | 'standard' | 'performance';

export interface ServiceLifecycleState {
  name: string;
  display_name: string;
  state: ServiceState;
  policy: LifecyclePolicy;
  installed: boolean;
  last_started_at: string | null;
  last_stopped_at: string | null;
  last_activity_at: string | null;
  idle_seconds: number;
  ram_mb: number | null;
  ram_limit_mb: number;
  uptime_seconds: number | null;
  timeout_remaining_seconds: number | null;
  error: string | null;
  started_by: string | null;
  drain_guards_active: string[];
  category: string;
  tier: string;
  estimated_start_seconds: number;
}

export interface RamBudgetStatus {
  profile: HardwareProfileTier;
  total_budget_mb: number;
  used_mb: number;
  available_mb: number;
  running_services: Array<{ name: string; ram_mb: number }>;
}

export interface HardwareProfile {
  tier: HardwareProfileTier;
  total_ram_mb: number;
  reserved_os_mb: number;
  reserved_core_mb: number;
  budget_services_mb: number;
  max_concurrent_ondemand: number;
  default_timeout_minutes: number;
  excluded_services: string[];
  is_wsl2: boolean;
}

// ─── Store ───────────────────────────────────────────────

interface ServicesState {
  services: ServiceLifecycleState[];
  ramBudget: RamBudgetStatus | null;
  profile: HardwareProfile | null;
  loading: boolean;
  error: string | null;

  fetchServices: () => Promise<void>;
  fetchRamBudget: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  startService: (name: string) => Promise<void>;
  stopService: (name: string) => Promise<void>;
  forceStopService: (name: string) => Promise<void>;
  updateServiceFromWS: (event: string, data: Record<string, unknown>) => void;
}

export const useServicesStore = create<ServicesState>()((set, get) => ({
  services: [],
  ramBudget: null,
  profile: null,
  loading: false,
  error: null,

  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: ServiceLifecycleState[] }>('/services');
      set({ services: res.data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch services', loading: false });
    }
  },

  fetchRamBudget: async () => {
    try {
      const res = await api.get<{ data: RamBudgetStatus }>('/system/ram-budget');
      set({ ramBudget: res.data });
    } catch { /* ignore */ }
  },

  fetchProfile: async () => {
    try {
      const res = await api.get<{ data: HardwareProfile }>('/system/profile');
      set({ profile: res.data });
    } catch { /* ignore */ }
  },

  startService: async (name: string) => {
    // Optimistic update
    const services = get().services.map((s) =>
      s.name === name ? { ...s, state: 'starting' as ServiceState } : s,
    );
    set({ services });

    try {
      await api.post(`/services/${name}/start`);
      await get().fetchServices();
      await get().fetchRamBudget();
    } catch (err) {
      await get().fetchServices();
      throw err;
    }
  },

  stopService: async (name: string) => {
    try {
      await api.post(`/services/${name}/stop`);
      await get().fetchServices();
      await get().fetchRamBudget();
    } catch (err) {
      await get().fetchServices();
      throw err;
    }
  },

  forceStopService: async (name: string) => {
    try {
      await api.post(`/services/${name}/force-stop`);
      await get().fetchServices();
      await get().fetchRamBudget();
    } catch (err) {
      await get().fetchServices();
      throw err;
    }
  },

  updateServiceFromWS: (event: string, data: Record<string, unknown>) => {
    const serviceName = data.service as string;
    if (!serviceName) return;

    const services = get().services.map((s) => {
      if (s.name !== serviceName) return s;

      switch (event) {
        case 'service.starting':
          return { ...s, state: 'starting' as ServiceState };
        case 'service.ready':
          return {
            ...s,
            state: 'running' as ServiceState,
            ram_mb: (data.ram_usage_mb as number) ?? s.ram_mb,
          };
        case 'service.draining':
          return {
            ...s,
            state: 'draining' as ServiceState,
            drain_guards_active: ((data.guards as any[]) ?? []).map((g: any) => g.name),
          };
        case 'service.stopped':
          return {
            ...s,
            state: 'stopped' as ServiceState,
            ram_mb: null,
            drain_guards_active: [],
          };
        case 'service.failed':
          return {
            ...s,
            state: 'failed' as ServiceState,
            error: (data.error as string) ?? null,
          };
        default:
          return s;
      }
    });

    set({ services });
  },
}));

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
import { updateServiceResourcePolicy } from '@/services/lifecycle.service';

// ─── Types ───────────────────────────────────────────────

export type ServiceState = 'stopped' | 'starting' | 'running' | 'draining' | 'failed';
export type LifecyclePolicy = 'always' | 'ondemand' | 'scheduled';
export type ResourcePriorityClass = 'critical' | 'high' | 'normal' | 'low';
export type ResourcePolicyPatch = {
  lifecycle?: LifecyclePolicy;
  schedule?: ScheduleConfig;
  priority_class?: Exclude<ResourcePriorityClass, 'critical'>;
};
export type BulkResourcePolicyResult = {
  updated: string[];
  failed: Array<{ name: string; error: string }>;
};
// Seis tramos nombrados por su RAM (2026-08-06). Los tres anteriores —`lite`/`standard`/
// `performance`— los sigue aceptando el PUT de Core y los traduce al guardar, así que un
// override viejo se migra solo la primera vez que el usuario toca el selector.
export const HARDWARE_PROFILE_TIERS = ['4gb', '8gb', '16gb', '32gb', '64gb', '128gb'] as const;
export type HardwareProfileTier = (typeof HARDWARE_PROFILE_TIERS)[number];

export interface ScheduleWindow {
  days: number[];
  start_time: string;
  end_time: string;
}

export interface ScheduleConfig {
  type: 'window' | 'interval';
  windows?: ScheduleWindow[];
  interval_every_minutes?: number;
  interval_on_minutes?: number;
}

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
  /**
   * Non-null = el servicio está arrancado pero NO usable todavía: qué le falta
   * al operador. Lo emite Core desde el `ServiceNotConfiguredError` del adapter
   * (p.ej. Tailscale con el contenedor corriendo y la sesión sin autenticar).
   * Se pinta en ámbar en vez del punto verde de «running».
   */
  setup_hint: string | null;
  started_by: string | null;
  drain_guards_active: string[];
  category: string;
  tier: string;
  estimated_start_seconds: number;
  ram_reservation_mb: number;
  priority_class: ResourcePriorityClass;
  schedule: ScheduleConfig | null;
  timeout_seconds: number | null;
  resource_status: {
    state: 'applied' | 'drift' | 'not-installed' | 'native-pending' | 'error';
    reservation_mb?: number;
    maximum_mb?: number;
    detail?: string;
  } | null;
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

export interface SystemResources {
  platform: 'wsl2' | 'mac-vm' | 'bare-metal' | 'vm' | 'container' | 'unknown';
  capabilities: {
    vm_resources: boolean;
    host_apply: boolean;
    cpu_limit: boolean;
    external_management: boolean;
  };
  hardware: {
    host_total_ram_mb: number;
    guest_total_ram_mb: number;
    host_logical_cpus: number;
    guest_logical_cpus: number;
    guest_swap_mb: number;
  };
  profile: {
    desired: HardwareProfileTier;
    effective: HardwareProfileTier;
    budget_services_mb: number;
    recommended_vm_ram_mb: number;
    available: Array<{ tier: HardwareProfileTier; enabled: boolean; reason: string | null }>;
  };
  host: {
    mode: 'managed' | 'external';
    reconciliation: 'applied' | 'pending' | 'drift' | 'externally-managed' | 'unsupported';
    configured_ram_mb: number | null;
    configured_processors: number;
    configured_swap_mb: number | null;
    networking_mode: string | null;
    auto_memory_reclaim: string | null;
    invalid_page_reporting: boolean;
    running_wsl_distros: string[];
  };
  settings: {
    default_timeout_minutes: number;
    ram_pressure_threshold_percent: number;
    auto_evict_on_pressure: boolean;
    notifications_enabled: boolean;
  };
}

export interface ResourcePlan {
  id: string;
  profile: HardwareProfileTier;
  cpu_limit: number;
  vm_memory_mb: number;
  swap_mb: number;
  services_blocked: string[];
  services_to_stop: string[];
  services_preserved: string[];
  requires_vm_restart: boolean;
  affected_wsl_distros: string[];
}

// ─── Store ───────────────────────────────────────────────

interface ServicesState {
  services: ServiceLifecycleState[];
  ramBudget: RamBudgetStatus | null;
  profile: HardwareProfile | null;
  resources: SystemResources | null;
  resourcePlan: ResourcePlan | null;
  loading: boolean;
  error: string | null;

  fetchServices: () => Promise<void>;
  fetchRamBudget: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchResources: () => Promise<void>;
  planResources: (profile: HardwareProfileTier, cpuLimit?: number) => Promise<ResourcePlan>;
  applyResourcePlan: (planId: string, restartNow?: boolean) => Promise<void>;
  startService: (name: string) => Promise<void>;
  stopService: (name: string) => Promise<void>;
  forceStopService: (name: string) => Promise<void>;
  updatePolicy: (name: string, policy: LifecyclePolicy, schedule?: ScheduleConfig) => Promise<void>;
  updateResourcePolicy: (name: string, patch: ResourcePolicyPatch) => Promise<void>;
  updateResourcePolicies: (names: string[], patch: ResourcePolicyPatch) => Promise<BulkResourcePolicyResult>;
  updateGlobalSettings: (patch: Partial<SystemResources['settings']>) => Promise<void>;
  updateServiceFromWS: (event: string, data: Record<string, unknown>) => void;
}

export const useServicesStore = create<ServicesState>()((set, get) => ({
  services: [],
  ramBudget: null,
  profile: null,
  resources: null,
  resourcePlan: null,
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

  fetchResources: async () => {
    try {
      const res = await api.get<{ data: SystemResources }>('/system/resources');
      set({ resources: res.data });
    } catch { /* older Core versions keep the existing profile UI usable */ }
  },

  planResources: async (profile, cpuLimit) => {
    const res = await api.post<{ data: ResourcePlan }>('/system/resources/plan', {
      profile,
      ...(cpuLimit ? { cpu_limit: cpuLimit } : {}),
    });
    set({ resourcePlan: res.data });
    return res.data;
  },

  applyResourcePlan: async (planId, restartNow = false) => {
    await api.post('/system/resources/apply', { plan_id: planId, confirm: true, restart_now: restartNow });
    set({ resourcePlan: null });
    await Promise.all([get().fetchResources(), get().fetchProfile(), get().fetchRamBudget(), get().fetchServices()]);
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

  updatePolicy: async (name: string, policy: LifecyclePolicy, schedule?: ScheduleConfig) => {
    await updateServiceResourcePolicy(name, { lifecycle: policy, schedule });
    await get().fetchServices();
  },

  updateResourcePolicy: async (name, patch) => {
    await updateServiceResourcePolicy(name, patch);
    await get().fetchServices();
  },

  updateResourcePolicies: async (names, patch) => {
    const results = await Promise.allSettled(
      names.map((name) => updateServiceResourcePolicy(name, patch)),
    );
    const updated: string[] = [];
    const failed: BulkResourcePolicyResult['failed'] = [];
    results.forEach((result, index) => {
      const name = names[index]!;
      if (result.status === 'fulfilled') updated.push(name);
      else failed.push({
        name,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });
    });
    await get().fetchServices();
    return { updated, failed };
  },

  updateGlobalSettings: async (patch) => {
    await api.patch('/system/resources/settings', patch);
    await get().fetchResources();
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

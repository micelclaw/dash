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
import type {
  StorageStatus, StorageCapabilities, DataUsageResult,
  Disk, Volume, SmartStatus, StoragePool, StorageShare,
  PoolConfig, ShareConfig,
} from '@/modules/storage/types';

// ─── Store ──────────────────────────────────────────────

interface StorageState {
  status: StorageStatus | null;
  capabilities: StorageCapabilities | null;
  provider: string | null;
  data_usage: DataUsageResult | null;
  disks: Disk[];
  volumes: Volume[];
  pools: StoragePool[];
  shares: StorageShare[];
  smart_cache: Record<string, SmartStatus>;
  loading: boolean;
  error: string | null;
  expanded_disks: string[];

  fetchAll: () => Promise<void>;
  fetchSmart: (diskId: string) => Promise<void>;
  toggleDisk: (diskId: string) => void;
  createPool: (config: PoolConfig) => Promise<void>;
  deletePool: (poolId: string) => Promise<void>;
  createShare: (config: ShareConfig) => Promise<void>;
  deleteShare: (shareId: string) => Promise<void>;
  detectProvider: () => Promise<void>;
}

export const useStorageStore = create<StorageState>()((set, get) => ({
  status: null,
  capabilities: null,
  provider: null,
  data_usage: null,
  disks: [],
  volumes: [],
  pools: [],
  shares: [],
  smart_cache: {},
  loading: false,
  error: null,
  expanded_disks: [],

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      // Phase 1: status + capabilities in parallel
      const [statusRes, capsRes] = await Promise.all([
        api.get<{ data: StorageStatus }>('/hal/storage/status'),
        api.get<{ data: { provider: string; capabilities: StorageCapabilities; missing_for_full: string | null } }>('/hal/storage/capabilities'),
      ]);

      const caps = capsRes.data.capabilities;
      const provider = capsRes.data.provider;

      // Phase 2: data depending on capabilities, in parallel
      const disksP = api.get<{ data: Disk[] }>('/hal/storage/disks');
      const volumesP = api.get<{ data: Volume[] }>('/hal/storage/volumes');
      const usageP = api.get<{ data: DataUsageResult }>('/hal/storage/data-usage');
      const poolsP = caps.can_create_pool ? api.get<{ data: StoragePool[] }>('/hal/storage/pools') : null;
      const sharesP = caps.can_manage_shares ? api.get<{ data: StorageShare[] }>('/hal/storage/shares') : null;

      const [disksRes, volumesRes, usageRes, poolsRes, sharesRes] = await Promise.all([
        disksP, volumesP, usageP, poolsP, sharesP,
      ]);

      set({
        status: statusRes.data,
        capabilities: caps,
        provider,
        disks: disksRes.data,
        volumes: volumesRes.data,
        data_usage: usageRes.data,
        pools: poolsRes?.data ?? [],
        shares: sharesRes?.data ?? [],
        loading: false,
      });
    } catch {
      set({ error: 'Failed to load storage data', loading: false });
    }
  },

  fetchSmart: async (diskId: string) => {
    try {
      const res = await api.get<{ data: SmartStatus | null }>(`/hal/storage/disks/${encodeURIComponent(diskId)}/smart`);
      if (res.data) {
        set({ smart_cache: { ...get().smart_cache, [diskId]: res.data } });
      }
    } catch {
      // Non-fatal — SMART may not be available
    }
  },

  toggleDisk: (diskId: string) => {
    const { expanded_disks, capabilities, smart_cache } = get();
    const isExpanded = expanded_disks.includes(diskId);
    if (isExpanded) {
      set({ expanded_disks: expanded_disks.filter((id) => id !== diskId) });
    } else {
      set({ expanded_disks: [...expanded_disks, diskId] });
      // Auto-fetch SMART if available and not cached
      if (capabilities?.can_get_smart && !smart_cache[diskId]) {
        get().fetchSmart(diskId);
      }
    }
  },

  createPool: async (config: PoolConfig) => {
    await api.post('/hal/storage/pools', config);
    const res = await api.get<{ data: StoragePool[] }>('/hal/storage/pools');
    set({ pools: res.data });
  },

  deletePool: async (poolId: string) => {
    await api.delete(`/hal/storage/pools/${encodeURIComponent(poolId)}`);
    const res = await api.get<{ data: StoragePool[] }>('/hal/storage/pools');
    set({ pools: res.data });
  },

  createShare: async (config: ShareConfig) => {
    await api.post('/hal/storage/shares', config);
    const res = await api.get<{ data: StorageShare[] }>('/hal/storage/shares');
    set({ shares: res.data });
  },

  deleteShare: async (shareId: string) => {
    await api.delete(`/hal/storage/shares/${encodeURIComponent(shareId)}`);
    const res = await api.get<{ data: StorageShare[] }>('/hal/storage/shares');
    set({ shares: res.data });
  },

  detectProvider: async () => {
    await api.post('/hal/storage/detect-provider');
    await get().fetchAll();
  },
}));

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
  setPreviewMode: (enabled: boolean) => Promise<void>;

  // ── Storage ZFS (Ola 0, contract-first) — backend stub (501) ──
  // Firmas de acción CONGELADAS para los implementadores de pantallas (olas
  // posteriores). El backend ZFS aún no existe (rutas 501) → fetchZfs degrada a
  // arrays vacíos sin romper la UI. Los tipos precisos de config/vista llegan con
  // sus pantallas; aquí se fija el contrato de nombres/forma.
  zfs_pools: Record<string, unknown>[];
  zfs_datasets: Record<string, unknown>[];
  zfs_snapshots: Record<string, unknown>[];
  zfs_jobs: Record<string, unknown>[];
  fetchZfs: () => Promise<void>;
  createZfsPool: (config: Record<string, unknown>) => Promise<void>;
  destroyZfsPool: (poolId: string, token: string) => Promise<void>;
  startScrub: (pool: string) => Promise<void>;
  createSnapshot: (target: string, snapName: string) => Promise<void>;
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
  zfs_pools: [],
  zfs_datasets: [],
  zfs_snapshots: [],
  zfs_jobs: [],

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

  // Toggle the simulated "NAS preview" provider (demo disks/RAID/shares).
  setPreviewMode: async (enabled: boolean) => {
    await api.post('/hal/storage/preview', { enabled });
    await get().fetchAll();
  },

  // ── Storage ZFS (Ola 0, contract-first) ──
  // Lee el inventario ZFS de los endpoints nuevos; tolerante al 501 (backend no
  // implementado todavía) → deja los arrays vacíos sin romper la UI.
  fetchZfs: async () => {
    try {
      const [pools, datasets, snapshots, jobs] = await Promise.all([
        api.get<{ data: Record<string, unknown>[] }>('/hal/storage/datasets').then(() => [] as Record<string, unknown>[]).catch(() => []),
        api.get<{ data: Record<string, unknown>[] }>('/hal/storage/zvols').then(() => [] as Record<string, unknown>[]).catch(() => []),
        api.get<{ data: Record<string, unknown>[] }>('/hal/storage/snapshots').then(() => [] as Record<string, unknown>[]).catch(() => []),
        api.get<{ data: Record<string, unknown>[] }>('/hal/storage/jobs').then(() => [] as Record<string, unknown>[]).catch(() => []),
      ]);
      set({ zfs_pools: pools, zfs_datasets: datasets, zfs_snapshots: snapshots, zfs_jobs: jobs });
    } catch {
      // Backend ZFS no implementado (501) — degradación silenciosa.
    }
  },
  // Acciones de escritura: contrato congelado; backend 501 hasta su fase (roadmap §7).
  createZfsPool: async (_config: Record<string, unknown>) => {
    throw new Error('Storage ZFS aún no implementado (Ola 0, contract-first).');
  },
  destroyZfsPool: async (_poolId: string, _token: string) => {
    throw new Error('Storage ZFS aún no implementado (Ola 0, contract-first).');
  },
  startScrub: async (_pool: string) => {
    throw new Error('Storage ZFS aún no implementado (Ola 0, contract-first).');
  },
  createSnapshot: async (_target: string, _snapName: string) => {
    throw new Error('Storage ZFS aún no implementado (Ola 0, contract-first).');
  },
}));

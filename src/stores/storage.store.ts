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
  ZfsCapabilities, ZfsPoolObservation, ZfsDatasetObservation, ZfsSnapshotObservation, VmObservation,
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

  // ── Storage ZFS (Olas 0-6) — backend nativo ──
  // Read-path real: capabilities (plataforma-aware, degradado honesto) + inventario
  // observado del FS (pools/datasets/zvols/snapshots/VMs). En WSL2/read-only el
  // inventario llega vacío y las capabilities marcan degraded_reason → la UI lo
  // muestra en vez de fingir. Las escrituras (pool/dataset/VM) son wizards gated
  // que llegan con bare-metal (diseño §9); aquí el read-path + las acciones safe.
  zfs_capabilities: ZfsCapabilities | null;
  zfs_pools: ZfsPoolObservation[];
  zfs_datasets: ZfsDatasetObservation[];
  zfs_zvols: ZfsDatasetObservation[];
  zfs_snapshots: ZfsSnapshotObservation[];
  zfs_vms: VmObservation[];
  zfs_loading: boolean;
  fetchZfs: () => Promise<void>;
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
  zfs_capabilities: null,
  zfs_pools: [],
  zfs_datasets: [],
  zfs_zvols: [],
  zfs_snapshots: [],
  zfs_vms: [],
  zfs_loading: false,

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

  // ── Storage ZFS (Olas 0-6) — read-path real ──
  // Capabilities primero (gobierna el render); luego, si se puede observar, el
  // inventario en paralelo. Cada llamada es tolerante (un endpoint que falle no
  // tumba el resto). Las VMs son admin-only → 403 para no-admin → [] silencioso.
  fetchZfs: async () => {
    set({ zfs_loading: true });
    try {
      const capsRes = await api
        .get<{ data: ZfsCapabilities }>('/hal/storage/zfs/capabilities')
        .catch(() => null);
      const caps = capsRes?.data ?? null;

      const empty = { zfs_pools: [], zfs_datasets: [], zfs_zvols: [], zfs_snapshots: [], zfs_vms: [] };
      if (!caps?.can_inspect) {
        set({ zfs_capabilities: caps, ...empty, zfs_loading: false });
        return;
      }

      const [pools, datasets, zvols, snapshots, vms] = await Promise.all([
        api.get<{ data: ZfsPoolObservation[] }>('/hal/storage/zfs/pools').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsDatasetObservation[] }>('/hal/storage/datasets').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsDatasetObservation[] }>('/hal/storage/zvols').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsSnapshotObservation[] }>('/hal/storage/snapshots').then((r) => r.data).catch(() => []),
        api.get<{ data: VmObservation[] }>('/hal/storage/vms').then((r) => r.data).catch(() => []),
      ]);
      set({ zfs_capabilities: caps, zfs_pools: pools, zfs_datasets: datasets, zfs_zvols: zvols, zfs_snapshots: snapshots, zfs_vms: vms, zfs_loading: false });
    } catch {
      set({ zfs_loading: false });
    }
  },
}));

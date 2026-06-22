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
import { buildZfsDemo } from '@/modules/storage/zfs-demo';

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
  zfs_demo: boolean;               // demo 100% cliente (no toca el backend gated)
  fetchZfs: () => Promise<void>;
  setZfsDemo: (enabled: boolean) => void;
  // Escrituras: en demo mutan estado local (UX completa); en real llaman al backend
  // gated (plan→token→apply donde aplica). Toda escritura refresca el inventario.
  zfsCreatePool: (config: { name: string; topology: string; disk_by_ids: string[]; encrypt?: boolean }) => Promise<void>;
  zfsDestroyPool: (name: string) => Promise<void>;
  zfsScrub: (pool: string) => Promise<void>;
  zfsCreateDataset: (config: { name: string; compression?: string; refquota_gb?: number; encrypt?: boolean }) => Promise<void>;
  zfsCreateZvol: (config: { name: string; volsize_gb: number; thin?: boolean }) => Promise<void>;
  zfsCreateSnapshot: (target: string, snapName: string) => Promise<void>;
  zfsDestroySnapshot: (fullName: string) => Promise<void>;
  zfsCreateVm: (config: { name: string; vcpus: number; mem_mib: number; disk_zvol: string; iso_path?: string }) => Promise<void>;
  zfsVmAction: (name: string, action: 'start' | 'stop' | 'destroy') => Promise<void>;
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
  zfs_demo: false,

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
  // Unifica la demo: el mismo Preview también enciende/apaga el demo ZFS, para que
  // "modo demo" muestre TODAS las interfaces (capa legacy + NAS ZFS) de una vez.
  setPreviewMode: async (enabled: boolean) => {
    await api.post('/hal/storage/preview', { enabled });
    get().setZfsDemo(enabled);
    await get().fetchAll();
  },

  // ── Storage ZFS (Olas 0-6) — read-path real ──
  // Capabilities primero (gobierna el render); luego, si se puede observar, el
  // inventario en paralelo. Cada llamada es tolerante (un endpoint que falle no
  // tumba el resto). Las VMs son admin-only → 403 para no-admin → [] silencioso.
  fetchZfs: async () => {
    if (get().zfs_demo) { loadZfsDemo(set); return; }
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

  setZfsDemo: (enabled: boolean) => {
    set({ zfs_demo: enabled });
    if (enabled) loadZfsDemo(set);
    else void get().fetchZfs();
  },

  // ── Escrituras ZFS (demo = mutación local; real = backend gated) ──
  zfsCreatePool: async (config) => {
    if (get().zfs_demo) {
      const guid = String(1e15 + Math.floor(Math.random() * 1e14));
      const sizePer = 8 * 1024 ** 4;
      const pool: ZfsPoolObservation = {
        name: config.name, guid, health: 'ONLINE',
        size_bytes: sizePer * Math.max(1, config.disk_by_ids.length - 2), alloc_bytes: 0,
        free_bytes: sizePer * Math.max(1, config.disk_by_ids.length - 2), frag_pct: 0, cap_pct: 0,
        vdevs: [{
          name: `${config.topology}-0`, type: config.topology, state: 'ONLINE',
          read_errors: 0, write_errors: 0, cksum_errors: 0,
          disks: config.disk_by_ids.map((d) => ({ name: d, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0 })),
        }],
      };
      set({ zfs_pools: [...get().zfs_pools, pool] });
      return;
    }
    // Real: plan → token → apply.
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/plan', config);
    await api.post('/hal/storage/zfs/pools', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },
  zfsDestroyPool: async (name) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.filter((p) => p.name !== name),
        zfs_datasets: get().zfs_datasets.filter((d) => d.name.split('/')[0] !== name),
        zfs_zvols: get().zfs_zvols.filter((z) => z.name.split('/')[0] !== name),
        zfs_snapshots: get().zfs_snapshots.filter((s) => s.full_name.split('/')[0] !== name),
      });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/destroy/plan', { pool: name });
    await api.post('/hal/storage/zfs/destroy', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },
  zfsScrub: async (pool) => {
    if (get().zfs_demo) {
      set({ zfs_pools: get().zfs_pools.map((p) => p.name === pool ? { ...p, health: 'SCRUBBING' } : p) });
      return;
    }
    await api.post('/hal/storage/zfs/scrub', { pool });
    await get().fetchZfs();
  },
  zfsCreateDataset: async (config) => {
    if (get().zfs_demo) {
      const ds: ZfsDatasetObservation = {
        name: config.name, type: 'filesystem', used_bytes: 0, referenced_bytes: 0, available_bytes: 19 * 1024 ** 4,
        mountpoint: `/data/${config.name.split('/').slice(1).join('/')}`, volsize_bytes: null,
        refquota_bytes: config.refquota_gb ? config.refquota_gb * 1024 ** 3 : null, quota_bytes: null,
        compression: config.compression ?? 'lz4', encryption: config.encrypt ? 'aes-256-gcm' : 'off',
      };
      set({ zfs_datasets: [...get().zfs_datasets, ds] });
      return;
    }
    await api.post('/hal/storage/datasets', { name: config.name, compression: config.compression, refquota_bytes: config.refquota_gb ? config.refquota_gb * 1024 ** 3 : undefined, encrypt: config.encrypt });
    await get().fetchZfs();
  },
  zfsCreateZvol: async (config) => {
    if (get().zfs_demo) {
      const zv: ZfsDatasetObservation = {
        name: config.name, type: 'volume', used_bytes: 0, referenced_bytes: 0, available_bytes: 19 * 1024 ** 4,
        mountpoint: null, volsize_bytes: config.volsize_gb * 1024 ** 3, refquota_bytes: null, quota_bytes: null,
        compression: 'lz4', encryption: 'off',
      };
      set({ zfs_zvols: [...get().zfs_zvols, zv] });
      return;
    }
    await api.post('/hal/storage/zvols', { name: config.name, volsize_bytes: config.volsize_gb * 1024 ** 3, thin: config.thin });
    await get().fetchZfs();
  },
  zfsCreateSnapshot: async (target, snapName) => {
    if (get().zfs_demo) {
      const full = `${target}@${snapName}`;
      const s: ZfsSnapshotObservation = { full_name: full, snap_name: snapName, guid: String(Date.now()), used_bytes: 0, referenced_bytes: 0, creation: Math.floor(Date.now() / 1000) };
      set({ zfs_snapshots: [s, ...get().zfs_snapshots] });
      return;
    }
    await api.post('/hal/storage/snapshots', { target, snap_name: snapName });
    await get().fetchZfs();
  },
  zfsDestroySnapshot: async (fullName) => {
    if (get().zfs_demo) {
      set({ zfs_snapshots: get().zfs_snapshots.filter((s) => s.full_name !== fullName) });
      return;
    }
    await api.post('/hal/storage/snapshots/destroy', { full_name: fullName });
    await get().fetchZfs();
  },
  zfsCreateVm: async (config) => {
    if (get().zfs_demo) {
      const name = config.name.startsWith('claw-') ? config.name : `claw-${config.name}`;
      set({ zfs_vms: [...get().zfs_vms, { name, state: 'shut off' }] });
      return;
    }
    await api.post('/hal/storage/vms', config);
    await get().fetchZfs();
  },
  zfsVmAction: async (name, action) => {
    if (get().zfs_demo) {
      if (action === 'destroy') set({ zfs_vms: get().zfs_vms.filter((v) => v.name !== name) });
      else set({ zfs_vms: get().zfs_vms.map((v) => v.name === name ? { ...v, state: action === 'start' ? 'running' : 'shut off' } : v) });
      return;
    }
    const short = name.replace(/^claw-/, '');
    if (action === 'destroy') await api.post('/hal/storage/vms/destroy', { name: short });
    else await api.post(`/hal/storage/vms/${encodeURIComponent(short)}/${action}`, {});
    await get().fetchZfs();
  },
}));

// Carga el entorno demo fabricado en el store (clon fresco, aislado de la fuente).
function loadZfsDemo(set: (partial: Partial<StorageState>) => void): void {
  const demo = buildZfsDemo();
  set({
    zfs_capabilities: demo.capabilities,
    zfs_pools: demo.pools,
    zfs_datasets: demo.datasets,
    zfs_zvols: demo.zvols,
    zfs_snapshots: demo.snapshots,
    zfs_vms: demo.vms,
    zfs_loading: false,
  });
}

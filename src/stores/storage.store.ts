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
import { toast } from 'sonner';
import { api } from '@/services/api';
import type {
  StorageStatus, DataUsageResult,
  Disk, SmartStatus, SmartHistoryEntry,
  ZfsCapabilities, ZfsPoolObservation, ZfsDatasetObservation, ZfsSnapshotObservation,
  ZfsDiskObservation,
} from '@/modules/storage/types';
import { buildZfsDemo } from '@/modules/storage/zfs-demo';

// Persistencia (cliente) del modo demo: sobrevive a recargas sin estado en servidor.
const DEMO_KEY = 'claw-storage-demo';
function readDemoFlag(): boolean {
  try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
}

// ─── Store ──────────────────────────────────────────────

interface StorageState {
  status: StorageStatus | null;
  data_usage: DataUsageResult | null;
  disks: Disk[];
  smart_cache: Record<string, SmartStatus>;
  loading: boolean;
  error: string | null;
  expanded_disks: string[];

  fetchAll: () => Promise<void>;
  fetchSmart: (diskId: string) => Promise<void>;
  toggleDisk: (diskId: string) => void;
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

  // ── SMART tests/history + ZFS cache/log/special vdevs ──
  // smartTest dispara un autotest SMART (corto o largo) en un disco; fetchSmartHistory
  // recupera el histórico de muestras SMART de ese disco; zfsAddCache añade un vdev
  // auxiliar (cache=L2ARC, log=SLOG, special=metadata) a una pool existente.
  smartTest: (diskId: string, kind: 'short' | 'long') => Promise<void>;
  fetchSmartHistory: (diskId: string) => Promise<SmartHistoryEntry[]>;
  zfsAddCache: (pool: string, kind: 'cache' | 'log' | 'special', disk_by_ids: string[]) => Promise<void>;

  // ── SMART bulk + acciones avanzadas ZFS (F2) ──
  // fetchAllSmart trae el SMART de TODOS los discos de una (se llama dentro de
  // fetchAll cuando la plataforma lo soporta). Las 12 acciones siguen el mismo
  // patrón que el resto de escrituras: rama demo = mutación local del store;
  // rama real = POST al endpoint documentado + fetchZfs() (gated por caps falsy,
  // así que hoy solo se alcanza la rama demo — el cableado queda listo).
  fetchAllSmart: () => Promise<void>;
  zfsClearErrors: (pool: string) => Promise<void>;
  zfsTrim: (pool: string) => Promise<void>;
  zfsSetAutotrim: (pool: string, on: boolean) => Promise<void>;
  zfsStopScrub: (pool: string) => Promise<void>;
  zfsAddSpare: (pool: string, disk_by_ids: string[]) => Promise<void>;
  zfsRemoveAuxVdev: (pool: string, vdev_name: string) => Promise<void>;
  zfsDiskAction: (pool: string, disk_name: string, action: 'offline' | 'online' | 'detach') => Promise<void>;
  zfsExportPool: (pool: string) => Promise<void>;
  zfsImportPool: (name: string) => Promise<void>;
  zfsUpgradePool: (pool: string) => Promise<void>;
  zfsSetPoolProp: (pool: string, prop: string, value: string) => Promise<void>;
}

export const useStorageStore = create<StorageState>()((set, get) => ({
  status: null,
  data_usage: null,
  disks: [],
  smart_cache: {},
  loading: false,
  error: null,
  expanded_disks: [],
  zfs_capabilities: null,
  zfs_pools: [],
  zfs_datasets: [],
  zfs_zvols: [],
  zfs_snapshots: [],
  zfs_loading: false,
  zfs_demo: readDemoFlag(),

  fetchAll: async () => {
    // Demo 100% cliente: carga el entorno fabricado y NO toca el backend.
    if (get().zfs_demo) {
      loadZfsDemo(set);
      set({ loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      // Read-path real: estado agregado + discos + uso de datos en paralelo.
      const [statusRes, disksRes, usageRes] = await Promise.all([
        api.get<{ data: StorageStatus }>('/hal/storage/status'),
        api.get<{ data: Disk[] }>('/hal/storage/disks'),
        api.get<{ data: DataUsageResult }>('/hal/storage/data-usage'),
      ]);

      set({
        status: statusRes.data,
        disks: disksRes.data,
        data_usage: usageRes.data,
        loading: false,
      });

      // SMART de TODOS los discos de golpe + inventario ZFS (no bloquean el render).
      void get().fetchAllSmart();
      void get().fetchZfs();
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
    const { expanded_disks, smart_cache, zfs_demo } = get();
    const isExpanded = expanded_disks.includes(diskId);
    if (isExpanded) {
      set({ expanded_disks: expanded_disks.filter((id) => id !== diskId) });
    } else {
      set({ expanded_disks: [...expanded_disks, diskId] });
      // Auto-fetch SMART si no está cacheado (en demo ya viene precargado).
      if (!zfs_demo && !smart_cache[diskId]) {
        get().fetchSmart(diskId);
      }
    }
  },

  // Alias CLIENTE del modo demo: NO toca el backend (sin POST, sin badge).
  // El demo es 100% en memoria; setZfsDemo carga/limpia el entorno fabricado
  // (discos/SMART/estado/uso + pools/datasets/zvols/snapshots).
  setPreviewMode: async (enabled: boolean) => {
    get().setZfsDemo(enabled);
  },

  // ── Storage ZFS (Olas 0-6) — read-path real ──
  // Capabilities primero (gobierna el render); luego, si se puede observar, el
  // inventario en paralelo. Cada llamada es tolerante (un endpoint que falle no
  // tumba el resto).
  fetchZfs: async () => {
    if (get().zfs_demo) { loadZfsDemo(set); return; }
    set({ zfs_loading: true });
    try {
      const capsRes = await api
        .get<{ data: ZfsCapabilities }>('/hal/storage/zfs/capabilities')
        .catch(() => null);
      const caps = capsRes?.data ?? null;

      const empty = { zfs_pools: [], zfs_datasets: [], zfs_zvols: [], zfs_snapshots: [] };
      if (!caps?.can_inspect) {
        set({ zfs_capabilities: caps, ...empty, zfs_loading: false });
        return;
      }

      const [pools, datasets, zvols, snapshots] = await Promise.all([
        api.get<{ data: ZfsPoolObservation[] }>('/hal/storage/zfs/pools').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsDatasetObservation[] }>('/hal/storage/datasets').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsDatasetObservation[] }>('/hal/storage/zvols').then((r) => r.data).catch(() => []),
        api.get<{ data: ZfsSnapshotObservation[] }>('/hal/storage/snapshots').then((r) => r.data).catch(() => []),
      ]);
      set({ zfs_capabilities: caps, zfs_pools: pools, zfs_datasets: datasets, zfs_zvols: zvols, zfs_snapshots: snapshots, zfs_loading: false });
    } catch {
      set({ zfs_loading: false });
    }
  },

  setZfsDemo: (enabled: boolean) => {
    set({ zfs_demo: enabled });
    // Persistir el flag (cliente) para que la vista previa SOBREVIVA a recargas:
    // el demo es 100% en memoria, sin estado en el servidor.
    try {
      if (enabled) localStorage.setItem(DEMO_KEY, '1');
      else localStorage.removeItem(DEMO_KEY);
    } catch { /* SSR / storage no disponible: ignorar */ }
    // Al ENTRAR en demo: carga el entorno fabricado (cliente, sin backend).
    // Al SALIR: recarga el read-path real completo (status/disks/uso + ZFS + SMART).
    if (enabled) loadZfsDemo(set);
    else void get().fetchAll();
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
  // ── SMART tests/history (por disco) ──
  smartTest: async (diskId, kind) => {
    // En demo no hay disco real que testear: la UI muestra el toast simulado.
    if (get().zfs_demo) return;
    await api.post(`/hal/storage/disks/${encodeURIComponent(diskId)}/smart-test`, { type: kind });
  },
  fetchSmartHistory: async (diskId) => {
    if (get().zfs_demo) {
      // Histórico fabricado: ~8 muestras con fechas decrecientes (cada 6 h),
      // temperaturas/horas/sectores plausibles para una unidad sana.
      const now = Date.now();
      return Array.from({ length: 8 }, (_, i) => ({
        sampled_at: new Date(now - i * 6 * 3600 * 1000).toISOString(),
        overall_status: 'healthy' as const,
        temperature_c: 34 + (i % 4),
        power_on_hours: 18250 - i * 6,
        reallocated_sectors: 0,
        pending_sectors: 0,
      }));
    }
    return (await api.get<{ data: SmartHistoryEntry[] }>(`/hal/storage/disks/${encodeURIComponent(diskId)}/smart-history`)).data;
  },

  // ── Añadir vdev auxiliar (cache/log/special) a una pool ──
  zfsAddCache: async (pool, kind, disk_by_ids) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool
            ? {
                ...p,
                vdevs: [
                  ...p.vdevs,
                  {
                    name: `${kind}-0`, type: kind, state: 'ONLINE',
                    read_errors: 0, write_errors: 0, cksum_errors: 0,
                    disks: disk_by_ids.map((d) => ({ name: d, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0 })),
                  },
                ],
              }
            : p,
        ),
      });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/add-vdev/plan', { pool, topology: kind, disk_by_ids });
    await api.post('/hal/storage/zfs/pools/add-vdev', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  // ── SMART en bloque: trae el estado de TODOS los discos a la vez ──
  fetchAllSmart: async () => {
    try {
      const res = await api.get<{ data: SmartStatus[] }>('/hal/storage/smart');
      const next: Record<string, SmartStatus> = { ...get().smart_cache };
      for (const s of res.data) next[s.disk_id] = s;
      set({ smart_cache: next });
    } catch {
      // No fatal — SMART puede no estar disponible en la plataforma.
    }
  },

  // ── Acciones avanzadas ZFS (F2) ──
  // Patrón: demo = mutación local; real = POST documentado + fetchZfs (gated por
  // caps falsy → hoy solo se ejecuta la rama demo; el cableado real queda listo).
  zfsClearErrors: async (pool) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool
            ? {
                ...p,
                read_errors: 0, write_errors: 0, cksum_errors: 0, scrub_errors: 0,
                vdevs: p.vdevs.map((v) => ({
                  ...v,
                  read_errors: 0, write_errors: 0, cksum_errors: 0,
                  disks: v.disks.map((d) => ({ ...d, read_errors: 0, write_errors: 0, cksum_errors: 0 })),
                })),
              }
            : p,
        ),
      });
      return;
    }
    await api.post('/hal/storage/zfs/clear-errors', { pool });
    await get().fetchZfs();
  },

  zfsTrim: async (pool) => {
    if (get().zfs_demo) {
      toast.success(`TRIM iniciado en «${pool}»`);
      return;
    }
    await api.post('/hal/storage/zfs/trim', { pool });
    await get().fetchZfs();
  },

  zfsSetAutotrim: async (pool, on) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool ? { ...p, autotrim: on ? 'on' : 'off' } : p,
        ),
      });
      return;
    }
    await api.post('/hal/storage/zfs/pool/set-prop', { pool, prop: 'autotrim', value: on ? 'on' : 'off' });
    await get().fetchZfs();
  },

  zfsStopScrub: async (pool) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool ? { ...p, scrub_state: 'canceled', scrub_progress_pct: null } : p,
        ),
      });
      return;
    }
    await api.post('/hal/storage/zfs/scrub', { pool, action: 'stop' });
    await get().fetchZfs();
  },

  zfsAddSpare: async (pool, disk_by_ids) => {
    if (get().zfs_demo) {
      const newSpares: ZfsDiskObservation[] = disk_by_ids.map((d) => ({
        name: d, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0,
      }));
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool ? { ...p, spares: [...(p.spares ?? []), ...newSpares] } : p,
        ),
      });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/add-spare/plan', { pool, disk_by_ids });
    await api.post('/hal/storage/zfs/pools/add-spare', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  zfsRemoveAuxVdev: async (pool, vdev_name) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool ? { ...p, vdevs: p.vdevs.filter((v) => v.name !== vdev_name) } : p,
        ),
      });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/remove-vdev/plan', { pool, vdev_name });
    await api.post('/hal/storage/zfs/pools/remove-vdev', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  zfsDiskAction: async (pool, disk_name, action) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) => {
          if (p.name !== pool) return p;
          const vdevs = p.vdevs
            .map((v) => {
              if (action === 'detach') {
                return { ...v, disks: v.disks.filter((d) => d.name !== disk_name) };
              }
              return {
                ...v,
                disks: v.disks.map((d) =>
                  d.name === disk_name ? { ...d, state: action === 'offline' ? 'OFFLINE' : 'ONLINE' } : d,
                ),
              };
            })
            // detach puede vaciar un vdev auxiliar; lo quitamos si se queda sin discos.
            .filter((v) => v.disks.length > 0);
          return { ...p, vdevs };
        }),
      });
      return;
    }
    if (action === 'online') {
      await api.post('/hal/storage/zfs/pools/online', { pool, disk_name });
    } else {
      const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>(`/hal/storage/zfs/pools/${action}/plan`, { pool, disk_name });
      await api.post(`/hal/storage/zfs/pools/${action}`, { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    }
    await get().fetchZfs();
  },

  zfsExportPool: async (pool) => {
    if (get().zfs_demo) {
      set({ zfs_pools: get().zfs_pools.filter((p) => p.name !== pool) });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/export/plan', { pool });
    await api.post('/hal/storage/zfs/pools/export', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  zfsImportPool: async (name) => {
    if (get().zfs_demo) {
      // Re-fabricamos un pool mínimo ONLINE para "importar" en demo.
      const TB = 1024 ** 4;
      const pool: ZfsPoolObservation = {
        name, guid: String(1e15 + Math.floor(Math.random() * 1e14)), health: 'ONLINE',
        size_bytes: 8 * TB, alloc_bytes: 0, free_bytes: 8 * TB, frag_pct: 0, cap_pct: 0,
        scrub_state: 'none', scrub_progress_pct: null, scrub_errors: 0, scrub_finished_at: null,
        read_errors: 0, write_errors: 0, cksum_errors: 0, autotrim: 'off', ashift: 12,
        features: [], spares: [],
        vdevs: [{
          name: 'mirror-0', type: 'mirror', state: 'ONLINE',
          read_errors: 0, write_errors: 0, cksum_errors: 0,
          disks: [
            { name: `/dev/disk/by-id/imported-${name}-A`, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0 },
            { name: `/dev/disk/by-id/imported-${name}-B`, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0 },
          ],
        }],
      };
      set({ zfs_pools: [...get().zfs_pools, pool] });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/import/plan', { name });
    await api.post('/hal/storage/zfs/pools/import', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  zfsUpgradePool: async (pool) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) =>
          p.name === pool
            ? { ...p, features: (p.features ?? []).map((f) => ({ ...f, active: true })) }
            : p,
        ),
      });
      return;
    }
    const plan = await api.post<{ data: { plan_id: string; expected_token?: string } }>('/hal/storage/zfs/pools/upgrade/plan', { pool });
    await api.post('/hal/storage/zfs/pools/upgrade', { plan_id: plan.data.plan_id, token: plan.data.expected_token });
    await get().fetchZfs();
  },

  zfsSetPoolProp: async (pool, prop, value) => {
    if (get().zfs_demo) {
      set({
        zfs_pools: get().zfs_pools.map((p) => {
          if (p.name !== pool) return p;
          // Reflejamos en el estado local las props que la UI conoce.
          if (prop === 'autotrim') return { ...p, autotrim: value === 'on' ? 'on' : 'off' };
          if (prop === 'ashift') return { ...p, ashift: Number(value) || p.ashift };
          return p;
        }),
      });
      return;
    }
    await api.post('/hal/storage/zfs/pool/set-prop', { pool, prop, value });
    await get().fetchZfs();
  },
}));

// Carga el entorno demo fabricado en el store (clon fresco, aislado de la fuente).
// Setea TANTO la capa básica (discos/SMART/estado/uso) como la ZFS.
function loadZfsDemo(set: (partial: Partial<StorageState>) => void): void {
  const demo = buildZfsDemo();
  set({
    // Capa básica (read-service simulado).
    disks: demo.disks,
    smart_cache: demo.smartCache,
    status: demo.status,
    data_usage: demo.dataUsage,
    // Capa ZFS.
    zfs_capabilities: demo.capabilities,
    zfs_pools: demo.pools,
    zfs_datasets: demo.datasets,
    zfs_zvols: demo.zvols,
    zfs_snapshots: demo.snapshots,
    zfs_loading: false,
  });
}

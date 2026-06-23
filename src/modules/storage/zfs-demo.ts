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

// ─── Demo ZFS — entorno fabricado para "ver todas las interfaces" sin bare-metal ──
// 100% cliente: NO toca el backend gated. Simula un host zfs-hardened con dos pools
// (uno ONLINE RAIDZ2 con caché L2ARC y log SLOG en mirror, otro DEGRADED mirror con
// un disco con errores → para ver el estado degradado), datasets/zvols y snapshots
// auto (marcador namespaced). El store clona estas estructuras al activar el modo
// (las mutaciones del wizard no corrompen la fuente). Útil para revisar UX de
// pools/protección/recuperación.

import type {
  ZfsCapabilities, ZfsPoolObservation, ZfsDatasetObservation,
  ZfsSnapshotObservation,
} from './types';

const GB = 1024 ** 3;
const TB = 1024 ** 4;

export const DEMO_ZFS_CAPABILITIES: ZfsCapabilities = {
  backend: 'zfs',
  platform: 'bare-metal',
  level: 'zfs-hardened',
  can_inspect: true,
  can_create_pool: true,
  can_destroy_pool: true,
  can_expand_vdev: true,
  can_replace_disk: true,
  can_wipe_disk: true,
  can_create_dataset: true,
  can_create_zvol: true,
  can_snapshot: true,
  can_rollback: true,
  can_scrub: true,
  can_smart_test: true,
  can_replicate: true,
  can_encrypt: true,
  can_vm: true,
  // ── Acciones avanzadas (contrato F1/F2) ──
  can_clear: true,
  can_trim: true,
  can_autotrim: true,
  can_offline: true,
  can_online: true,
  can_detach: true,
  can_add_spare: true,
  can_remove_aux_vdev: true,
  can_export: true,
  can_import: true,
  can_upgrade: true,
  can_set_pool_prop: true,
};

// Discos "libres" simulados para el wizard de crear pool en modo demo.
export const DEMO_AVAILABLE_DISKS: { by_id: string; size_bytes: number; model: string }[] = [
  { by_id: '/dev/disk/by-id/ata-WDC_WD120EFBX-68B_FREE01', size_bytes: 12 * TB, model: 'WD Red Plus 12TB' },
  { by_id: '/dev/disk/by-id/ata-WDC_WD120EFBX-68B_FREE02', size_bytes: 12 * TB, model: 'WD Red Plus 12TB' },
  { by_id: '/dev/disk/by-id/ata-WDC_WD120EFBX-68B_FREE03', size_bytes: 12 * TB, model: 'WD Red Plus 12TB' },
  { by_id: '/dev/disk/by-id/ata-WDC_WD120EFBX-68B_FREE04', size_bytes: 12 * TB, model: 'WD Red Plus 12TB' },
  { by_id: '/dev/disk/by-id/nvme-Samsung_990_PRO_2TB_FREE05', size_bytes: 2 * TB, model: 'Samsung 990 PRO 2TB' },
  { by_id: '/dev/disk/by-id/nvme-Samsung_990_PRO_2TB_FREE06', size_bytes: 2 * TB, model: 'Samsung 990 PRO 2TB' },
];

export interface ZfsDemoState {
  capabilities: ZfsCapabilities;
  pools: ZfsPoolObservation[];
  datasets: ZfsDatasetObservation[];
  zvols: ZfsDatasetObservation[];
  snapshots: ZfsSnapshotObservation[];
}

/** Construye un snapshot of estado fresco (clonable). epochNow se inyecta para
 *  que las marcas de tiempo sean coherentes con "ahora". */
export function buildZfsDemo(epochNow = Math.floor(Date.now() / 1000)): ZfsDemoState {
  const tankGuid = '9876543210123456';
  const vaultGuid = '1122334455667788';

  const pools: ZfsPoolObservation[] = [
    {
      name: 'tank',
      guid: tankGuid,
      health: 'ONLINE',
      size_bytes: 36 * TB,
      alloc_bytes: 17 * TB,
      free_bytes: 19 * TB,
      frag_pct: 8,
      cap_pct: 47,
      // ── Estado sano: scrub terminado limpio, sin errores, autotrim on ──
      scrub_state: 'finished',
      scrub_progress_pct: 100,
      scrub_errors: 0,
      scrub_finished_at: new Date((epochNow - 6 * 24 * 3600) * 1000).toISOString(),
      read_errors: 0,
      write_errors: 0,
      cksum_errors: 0,
      autotrim: 'on',
      ashift: 12,
      features: [
        { name: 'lz4_compress', active: true },
        { name: 'draid', active: false },
        { name: 'zstd', active: false },
      ],
      // Disco de repuesto en caliente (hot spare) — ONLINE a la espera.
      spares: [
        { name: '/dev/disk/by-id/ata-WDC_WD80EFZZ-68B_SPARE1', state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0, temperature_c: 33 },
      ],
      vdevs: [
        {
          name: 'raidz2-0', type: 'raidz2', state: 'ONLINE',
          read_errors: 0, write_errors: 0, cksum_errors: 0,
          disks: Array.from({ length: 6 }, (_, i) => ({
            name: `/dev/disk/by-id/ata-WDC_WD80EFZZ-68B_VDL${i + 1}A`,
            state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0,
            temperature_c: 34 + (i % 5), // 34-38 °C
          })),
        },
        // Caché de lectura L2ARC (1 SSD NVMe)
        {
          name: 'cache', type: 'cache', state: 'ONLINE',
          read_errors: 0, write_errors: 0, cksum_errors: 0,
          disks: [
            { name: '/dev/disk/by-id/nvme-Samsung_990_PRO_2TB_CACHE', state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0, temperature_c: 41 },
          ],
        },
        // Log de escritura SLOG (mirror de 2 SSD)
        {
          name: 'log', type: 'log', state: 'ONLINE',
          read_errors: 0, write_errors: 0, cksum_errors: 0,
          disks: [
            { name: '/dev/disk/by-id/nvme-Samsung_983_DCT_240GB_SLOG1', state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0, temperature_c: 38 },
            { name: '/dev/disk/by-id/nvme-Samsung_983_DCT_240GB_SLOG2', state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0, temperature_c: 39 },
          ],
        },
      ],
    },
    {
      name: 'vault',
      guid: vaultGuid,
      health: 'DEGRADED',
      size_bytes: 4 * TB,
      alloc_bytes: 2.3 * TB,
      free_bytes: 1.7 * TB,
      frag_pct: 21,
      cap_pct: 58,
      // ── Estado degradado: scrub en curso, errores reales, autotrim off, sin spare ──
      scrub_state: 'scanning',
      scrub_progress_pct: 47,
      scrub_errors: 0,
      scrub_finished_at: null,
      read_errors: 12,
      write_errors: 0,
      cksum_errors: 4,
      autotrim: 'off',
      ashift: 12,
      features: [
        { name: 'lz4_compress', active: true },
        { name: 'draid', active: false },
        { name: 'encryption', active: true },
        { name: 'zstd', active: false },
      ],
      spares: [],
      vdevs: [{
        name: 'mirror-0', type: 'mirror', state: 'DEGRADED',
        read_errors: 0, write_errors: 0, cksum_errors: 4,
        disks: [
          { name: '/dev/disk/by-id/ata-Samsung_870_QVO_4TB_S1A', state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0, temperature_c: 36 },
          { name: '/dev/disk/by-id/ata-Samsung_870_QVO_4TB_S1B', state: 'FAULTED', read_errors: 12, write_errors: 0, cksum_errors: 4, temperature_c: 44 },
        ],
      }],
    },
  ];

  const datasets: ZfsDatasetObservation[] = [
    { name: 'tank/media', type: 'filesystem', used_bytes: 12 * TB, referenced_bytes: 12 * TB, available_bytes: 19 * TB, mountpoint: '/data/media', volsize_bytes: null, refquota_bytes: null, quota_bytes: null, compression: 'lz4', encryption: 'off' },
    { name: 'tank/media/music', type: 'filesystem', used_bytes: 480 * GB, referenced_bytes: 480 * GB, available_bytes: 19 * TB, mountpoint: '/data/media/music', volsize_bytes: null, refquota_bytes: 1 * TB, quota_bytes: null, compression: 'lz4', encryption: 'off' },
    { name: 'tank/backups', type: 'filesystem', used_bytes: 4.2 * TB, referenced_bytes: 4.2 * TB, available_bytes: 19 * TB, mountpoint: '/data/backups', volsize_bytes: null, refquota_bytes: null, quota_bytes: null, compression: 'zstd', encryption: 'aes-256-gcm' },
    // ── Carpetas de usuario (home) con cuota de referencia (refquota) ──
    { name: 'tank/home/paco', type: 'filesystem', used_bytes: 85 * GB, referenced_bytes: 85 * GB, available_bytes: 200 * GB - 85 * GB, mountpoint: '/data/home/paco', volsize_bytes: null, refquota_bytes: 200 * GB, quota_bytes: null, compression: 'lz4', encryption: 'aes-256-gcm' },
    // lucia está cerca del límite de su cuota (140/150 GB) → buen caso para ver el aviso.
    { name: 'tank/home/lucia', type: 'filesystem', used_bytes: 140 * GB, referenced_bytes: 140 * GB, available_bytes: 150 * GB - 140 * GB, mountpoint: '/data/home/lucia', volsize_bytes: null, refquota_bytes: 150 * GB, quota_bytes: null, compression: 'lz4', encryption: 'aes-256-gcm' },
    { name: 'vault/docs', type: 'filesystem', used_bytes: 220 * GB, referenced_bytes: 220 * GB, available_bytes: 1.7 * TB, mountpoint: '/data/docs', volsize_bytes: null, refquota_bytes: 500 * GB, quota_bytes: null, compression: 'zstd', encryption: 'aes-256-gcm' },
  ];

  const zvols: ZfsDatasetObservation[] = [
    { name: 'tank/vms/win11', type: 'volume', used_bytes: 64 * GB, referenced_bytes: 64 * GB, available_bytes: 19 * TB, mountpoint: null, volsize_bytes: 120 * GB, refquota_bytes: null, quota_bytes: null, compression: 'lz4', encryption: 'off' },
    { name: 'tank/vms/debian', type: 'volume', used_bytes: 18 * GB, referenced_bytes: 18 * GB, available_bytes: 19 * TB, mountpoint: null, volsize_bytes: 40 * GB, refquota_bytes: null, quota_bytes: null, compression: 'lz4', encryption: 'off' },
  ];

  const H = 3600;
  const tag = (g: string, secsAgo: number) => {
    const d = new Date((epochNow - secsAgo) * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}t${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}z`;
    return `claw-auto-${g.slice(0, 12)}-${ts}`;
  };
  const snap = (target: string, g: string, secsAgo: number, used: number): ZfsSnapshotObservation => {
    const snapName = tag(g, secsAgo);
    return { full_name: `${target}@${snapName}`, snap_name: snapName, guid: `${g}${secsAgo}`, used_bytes: used, referenced_bytes: used * 3, creation: epochNow - secsAgo };
  };

  const snapshots: ZfsSnapshotObservation[] = [
    snap('tank/media', tankGuid, 1 * H, 120 * GB),
    snap('tank/media', tankGuid, 24 * H, 90 * GB),
    snap('tank/media', tankGuid, 7 * 24 * H, 60 * GB),
    snap('tank/backups', tankGuid, 1 * H, 8 * GB),
    snap('tank/backups', tankGuid, 24 * H, 6 * GB),
    snap('vault/docs', vaultGuid, 2 * H, 2 * GB),
    // un snapshot MANUAL (sin marcador) — la retención NUNCA lo toca
    { full_name: 'tank/backups@antes-de-migrar', snap_name: 'antes-de-migrar', guid: 'manual1', used_bytes: 12 * GB, referenced_bytes: 36 * GB, creation: epochNow - 30 * 24 * H },
  ];

  // Clonado profundo barato (estructuras JSON puras) para aislar mutaciones.
  return JSON.parse(JSON.stringify({
    capabilities: DEMO_ZFS_CAPABILITIES, pools, datasets, zvols, snapshots,
  })) as ZfsDemoState;
}

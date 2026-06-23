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
  ZfsSnapshotObservation, Disk, SmartStatus, StorageStatus, DataUsageResult,
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
  // ── Capa "básica" (read-service) simulada para los componentes legacy ──
  // (lista de discos físicos, SMART por disco, estado agregado, uso de datos).
  disks: Disk[];
  smartCache: Record<string, SmartStatus>;
  status: StorageStatus;
  dataUsage: DataUsageResult;
}

// ─── Discos físicos demo (espejo de demo.provider.ts) ──────────────
// 7 unidades: 3× WD Red Plus 4TB en pool, 1 SSD de sistema, 1 Seagate con AVISO
// (bad sectors), 2 NVMe libres. Los ids cumplen /^disk_[a-z0-9]+$/ (guard SMART).
function buildDemoDisks(): Disk[] {
  return [
    { id: 'disk_sda', device: '/dev/sda', model: 'WD Red Plus 4TB', vendor: 'Western Digital', firmware: '83.00A83', serial: 'WD-WCC7K0DA0001', size_bytes: 4 * TB, type: 'hdd', transport: 'sata', removable: false, temperature_c: 38, smart_status: 'healthy', pool: 'tank', allocation: 'pool', partitions: [{ id: 'disk_sda1', mount: null, size_bytes: 4 * TB, used_bytes: null, filesystem: 'linux_raid_member' }] },
    { id: 'disk_sdb', device: '/dev/sdb', model: 'WD Red Plus 4TB', vendor: 'Western Digital', firmware: '83.00A83', serial: 'WD-WCC7K0DA0002', size_bytes: 4 * TB, type: 'hdd', transport: 'sata', removable: false, temperature_c: 39, smart_status: 'healthy', pool: 'tank', allocation: 'pool', partitions: [{ id: 'disk_sdb1', mount: null, size_bytes: 4 * TB, used_bytes: null, filesystem: 'linux_raid_member' }] },
    { id: 'disk_sdc', device: '/dev/sdc', model: 'WD Red Plus 4TB', vendor: 'Western Digital', firmware: '83.00A83', serial: 'WD-WCC7K0DA0003', size_bytes: 4 * TB, type: 'hdd', transport: 'sata', removable: false, temperature_c: 41, smart_status: 'healthy', pool: 'tank', allocation: 'pool', partitions: [{ id: 'disk_sdc1', mount: null, size_bytes: 4 * TB, used_bytes: null, filesystem: 'linux_raid_member' }] },
    { id: 'disk_sdd', device: '/dev/sdd', model: 'Samsung 870 EVO 1TB', vendor: 'Samsung', firmware: 'SVQ01B6Q', serial: 'S6P0NX0T123456', size_bytes: 1 * TB, type: 'ssd', transport: 'sata', removable: false, temperature_c: 34, smart_status: 'healthy', pool: null, allocation: 'system', partitions: [{ id: 'disk_sdd1', mount: '/', size_bytes: 900 * GB, used_bytes: 120 * GB, filesystem: 'ext4' }, { id: 'disk_sdd2', mount: '[SWAP]', size_bytes: 16 * GB, used_bytes: 0, filesystem: 'swap' }] },
    // ── Unidad con AVISO: sectores reasignados/pendientes > 0, temperatura alta ──
    { id: 'disk_sde', device: '/dev/sde', model: 'Seagate IronWolf 2TB', vendor: 'Seagate', firmware: 'SC60', serial: 'ZA2ABCDE0001', size_bytes: 2 * TB, type: 'hdd', transport: 'sata', removable: false, temperature_c: 44, smart_status: 'warning', pool: null, allocation: 'unconfigured', partitions: [{ id: 'disk_sde1', mount: '/srv/scratch', size_bytes: 2 * TB, used_bytes: 600 * GB, filesystem: 'ext4' }] },
    // ── Dos NVMe "libres" (cache/log/special en el wizard de pool) ──
    { id: 'disk_nvme0n1', device: '/dev/nvme0n1', model: 'Samsung 990 PRO 2TB', vendor: 'Samsung', firmware: '4B2QJXD7', serial: 'S6Z1NX0W900001', size_bytes: 2 * TB, type: 'ssd', transport: 'nvme', removable: false, temperature_c: 36, smart_status: 'healthy', pool: null, allocation: 'unconfigured', partitions: [] },
    { id: 'disk_nvme1n1', device: '/dev/nvme1n1', model: 'Samsung 990 PRO 2TB', vendor: 'Samsung', firmware: '4B2QJXD7', serial: 'S6Z1NX0W900002', size_bytes: 2 * TB, type: 'ssd', transport: 'nvme', removable: false, temperature_c: 37, smart_status: 'healthy', pool: null, allocation: 'unconfigured', partitions: [] },
  ];
}

// SMART por disco. El de aviso (disk_sde) lleva reallocated/pending > 0.
function smartFor(diskId: string, tempC: number, hours: number, status: 'healthy' | 'warning' = 'healthy'): SmartStatus {
  const reallocated = status === 'warning' ? 8 : 0;
  const pending = status === 'warning' ? 2 : 0;
  return {
    disk_id: diskId,
    overall_status: status,
    power_on_hours: hours,
    temperature_c: tempC,
    reallocated_sectors: reallocated,
    pending_sectors: pending,
    last_test: '2026-06-15T03:00:00.000Z',
    attributes: [
      { id: 1, name: 'Raw_Read_Error_Rate', value: 200, worst: 200, threshold: 51, raw: 0 },
      { id: 5, name: 'Reallocated_Sector_Ct', value: status === 'warning' ? 96 : 100, worst: 100, threshold: 10, raw: reallocated },
      { id: 9, name: 'Power_On_Hours', value: 99, worst: 99, threshold: 0, raw: hours },
      { id: 194, name: 'Temperature_Celsius', value: 100 + tempC, worst: 95 + tempC, threshold: 0, raw: tempC },
      { id: 197, name: 'Current_Pending_Sector', value: 100, worst: 100, threshold: 0, raw: pending },
      { id: 198, name: 'Offline_Uncorrectable', value: 100, worst: 100, threshold: 0, raw: 0 },
    ],
  };
}

function buildDemoSmartCache(): Record<string, SmartStatus> {
  return {
    disk_sda: smartFor('disk_sda', 38, 14210),
    disk_sdb: smartFor('disk_sdb', 39, 14208),
    disk_sdc: smartFor('disk_sdc', 41, 14195),
    disk_sdd: smartFor('disk_sdd', 34, 9870),
    disk_sde: smartFor('disk_sde', 44, 31540, 'warning'),
    disk_nvme0n1: smartFor('disk_nvme0n1', 36, 1240),
    disk_nvme1n1: smartFor('disk_nvme1n1', 37, 1238),
  };
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

  // ── Capa básica simulada ──
  const disks = buildDemoDisks();
  const smartCache = buildDemoSmartCache();

  // Estado agregado coherente (volumen de datos del pool tank + sistema).
  // tank usable ≈ 8 TB (RAIDZ de las 3 WD), ~3.2 TB usados; sistema 900 GB / 120 GB.
  const totalBytes = 8 * TB + 900 * GB;
  const usedBytes = Math.round(3.2 * TB) + 120 * GB;
  const status: StorageStatus = {
    provider: 'demo',
    total_bytes: totalBytes,
    used_bytes: usedBytes,
    free_bytes: totalBytes - usedBytes,
    health: 'warning', // hay un disco con aviso (disk_sde) → no es 'healthy'
    disk_count: disks.length,
    volume_count: 2,
  };

  // Uso de datos por categorías (lo que pinta el donut "tus datos"): usuario, otros, sistema.
  const dataUsage: DataUsageResult = {
    total_data_bytes: 1180 * GB,
    cache_age_seconds: 0,
    categories: [
      { name: 'media', label: 'Multimedia', size_bytes: 620 * GB, status: 'ok', group: 'user' },
      { name: 'drive', label: 'Mis archivos', size_bytes: 240 * GB, status: 'ok', group: 'user' },
      { name: 'photos', label: 'Fotos', size_bytes: 95 * GB, status: 'ok', group: 'user' },
      { name: 'backups', label: 'Copias de seguridad', size_bytes: 150 * GB, status: 'ok', group: 'others' },
      { name: 'containers', label: 'Contenedores', size_bytes: 45 * GB, status: 'ok', group: 'system' },
      { name: 'system', label: 'Sistema', size_bytes: 30 * GB, status: 'ok', group: 'system' },
    ],
  };

  // Clonado profundo barato (estructuras JSON puras) para aislar mutaciones.
  return JSON.parse(JSON.stringify({
    capabilities: DEMO_ZFS_CAPABILITIES, pools, datasets, zvols, snapshots,
    disks, smartCache, status, dataUsage,
  })) as ZfsDemoState;
}

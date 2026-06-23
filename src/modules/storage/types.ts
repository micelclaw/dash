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

// ─── HAL Storage Frontend Types ────────────────────────────────────
// Mirrors backend types.ts — field names are snake_case because the
// ApiClient's transformKeys converts camelCase responses automatically.

export interface Partition {
  id: string;
  mount: string | null;
  size_bytes: number;
  used_bytes: number | null;
  filesystem: string | null;
}

export interface Disk {
  id: string;
  device: string;
  model: string;
  serial: string | null;
  size_bytes: number;
  type: 'ssd' | 'hdd' | 'unknown';
  transport: string | null;
  removable: boolean;
  temperature_c: number | null;
  smart_status: 'healthy' | 'warning' | 'critical' | null;
  pool: string | null;
  partitions: Partition[];
  firmware?: string | null;
  vendor?: string | null;
  allocation?: 'system' | 'pool' | 'spare' | 'unconfigured' | null;
}

export interface Volume {
  id: string;
  label: string;
  mount_point: string;
  filesystem: string;
  size_bytes: number;
  used_bytes: number;
  free_bytes: number;
  pool: string | null;
  status: 'mounted' | 'unmounted';
}

export interface StorageStatus {
  provider: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  disk_count?: number;
  volume_count?: number;
}

export interface SmartAttribute {
  id: number;
  name: string;
  value: number;
  worst: number;
  threshold: number;
  raw: number;
}

export interface SmartStatus {
  disk_id: string;
  overall_status: 'healthy' | 'warning' | 'critical';
  power_on_hours: number | null;
  temperature_c: number | null;
  reallocated_sectors: number;
  pending_sectors: number;
  attributes: SmartAttribute[];
  last_test: string | null;
}

export interface SmartHistoryEntry {
  sampled_at: string;
  overall_status: 'healthy' | 'warning' | 'critical';
  temperature_c: number | null;
  power_on_hours: number | null;
  reallocated_sectors: number;
  pending_sectors: number;
}

export interface DataCategoryResult {
  name: string;
  label: string;
  size_bytes: number;
  status: 'ok' | 'timeout' | 'empty' | 'calculating';
  group: 'user' | 'others' | 'system';
}

export interface DataUsageResult {
  total_data_bytes: number;
  categories: DataCategoryResult[];
  cache_age_seconds: number;
}

export interface StorageCapabilities {
  can_list_disks: boolean;
  can_list_volumes: boolean;
  can_get_usage: boolean;
  can_get_data_usage: boolean;
  can_get_smart: boolean;
  can_create_pool: boolean;
  can_delete_pool: boolean;
  can_create_volume: boolean;
  can_delete_volume: boolean;
  can_manage_shares: boolean;
  can_mount: boolean;
}

export interface StoragePool {
  id: string;
  name: string;
  type: 'raid0' | 'raid1' | 'raid5' | 'raid6' | 'raid10';
  status: 'active' | 'degraded' | 'inactive';
  size_bytes: number;
  used_bytes: number;
  disks: string[];
}

export interface PoolConfig {
  name: string;
  type: StoragePool['type'];
  disk_ids: string[];
}

export interface StorageShare {
  id: string;
  name: string;
  path: string;
  protocol: 'smb' | 'nfs';
  enabled: boolean;
}

export interface ShareConfig {
  name: string;
  path: string;
  protocol: 'smb' | 'nfs';
}

// ─── ZFS NAS backend (Olas 0-6) — espejo de core/src/hal/storage/zfs.types.ts ──
export type ZfsStorageLevel = 'zfs-hardened' | 'flexible' | 'read-only';

export interface ZfsCapabilities {
  backend: 'zfs' | 'linux-basic' | 'demo';
  platform: 'bare-metal' | 'wsl2' | 'container' | 'vm' | 'preview' | 'unknown';
  level: ZfsStorageLevel;
  can_inspect: boolean;
  can_create_pool: boolean;
  can_destroy_pool: boolean;
  can_expand_vdev: boolean;
  can_replace_disk: boolean;
  can_wipe_disk: boolean;
  can_create_dataset: boolean;
  can_create_zvol: boolean;
  can_snapshot: boolean;
  can_rollback: boolean;
  can_scrub: boolean;
  can_smart_test: boolean;
  can_replicate: boolean;
  can_encrypt: boolean;
  can_vm: boolean;
  degraded_reason?: string;
  can_clear?: boolean;
  can_trim?: boolean;
  can_autotrim?: boolean;
  can_offline?: boolean;
  can_online?: boolean;
  can_detach?: boolean;
  can_add_spare?: boolean;
  can_remove_aux_vdev?: boolean;
  can_export?: boolean;
  can_import?: boolean;
  can_upgrade?: boolean;
  can_set_pool_prop?: boolean;
}

export interface ZfsDiskObservation {
  name: string;
  state: string;
  read_errors: number;
  write_errors: number;
  cksum_errors: number;
  temperature_c?: number | null;
}
export interface ZfsVdevObservation {
  name: string;
  type: string;
  state: string;
  read_errors: number;
  write_errors: number;
  cksum_errors: number;
  disks: ZfsDiskObservation[];
}
export interface ZfsPoolObservation {
  name: string;
  guid: string | null;
  health: string;
  size_bytes: number | null;
  alloc_bytes: number | null;
  free_bytes: number | null;
  frag_pct: number | null;
  cap_pct: number | null;
  vdevs: ZfsVdevObservation[];
  scrub_state?: 'none' | 'scanning' | 'finished' | 'canceled';
  scrub_progress_pct?: number | null;
  scrub_errors?: number | null;
  scrub_finished_at?: string | null;
  read_errors?: number;
  write_errors?: number;
  cksum_errors?: number;
  spares?: ZfsDiskObservation[];
  autotrim?: 'on' | 'off' | null;
  ashift?: number | null;
  features?: Array<{ name: string; active: boolean }>;
}
export interface ZfsDatasetObservation {
  name: string;
  type: 'filesystem' | 'volume';
  used_bytes: number | null;
  referenced_bytes: number | null;
  available_bytes: number | null;
  mountpoint: string | null;
  volsize_bytes: number | null;
  refquota_bytes: number | null;
  quota_bytes: number | null;
  compression: string | null;
  encryption: string | null;
}
export interface ZfsSnapshotObservation {
  full_name: string;
  snap_name: string;
  guid: string | null;
  used_bytes: number | null;
  referenced_bytes: number | null;
  creation: number | null;
}
export interface VmObservation {
  name: string;
  state: string;
}

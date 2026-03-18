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

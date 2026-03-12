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

// ─── App system types — mirrors backend schemas ────────────────────

export type AppLevel = 1 | 2 | 3;
export type AppStatus = 'active' | 'disabled' | 'archived' | 'error' | 'pending_migration';
export type AppSource = 'local' | 'clawhub' | 'adapted';

export interface AppManifest {
  name: string;
  version: string;
  app_level: AppLevel;
  min_core_version: string;
  skill: string;
  description?: string;
  author?: string;
  tier_required: 'free' | 'pro';
  permissions: string[];
  ui?: {
    settings?: string;
    widget?: string;
    module?: {
      path: string;
      component: string;
      icon: string;
      label: string;
    };
  };
  hooks?: {
    on_install?: string;
    on_uninstall?: string;
    on_upgrade?: string;
  };
  api?: {
    schema?: string;
    routes_prefix?: string;
    tables?: string[];
    migration_version?: number;
  };
  docker?: {
    compose_file: string;
    required_version?: string;
  } | null;
  checksums?: Record<string, string>;
}

export interface InstalledApp {
  id: string;
  appName: string;
  version: string;
  appLevel: number;
  status: AppStatus;
  source: AppSource;
  installPath: string | null;
  manifest: AppManifest;
  installedBy: string | null;
  installedAt: string;
  updatedAt: string;
}

export interface AppRuntimeStatus {
  appName: string;
  version: string;
  level: AppLevel;
  status: 'loaded' | 'error' | 'disabled' | 'pending_migration';
  routesRegistered: number;
  tablesCreated: number;
  containersRunning?: number;
  loadedAt: string;
  error?: string;
}

export interface ScanResult {
  passed: boolean;
  level: 'L1' | 'L2' | 'L3';
  errors: Array<{ code: string; message: string; detail?: string }>;
  warnings: Array<{ code: string; message: string; detail?: string }>;
  scanned_at: string;
}

export interface InstallPayload {
  source: 'local' | 'clawhub';
  name: string;
  package_path?: string;
  clawhub_id?: string;
}

export interface InstallResult {
  installed_app: InstalledApp;
  scan_result: ScanResult;
  requires_openclaw_restart: boolean;
  requires_core_restart: boolean;
  agent_notice?: string;
}

export interface UninstallResult {
  name: string;
  status: string;
  requires_restart: boolean;
  purged: boolean;
  agent_notice?: string;
}

export interface AppsListResponse {
  data: InstalledApp[];
  meta: { total: number; by_level: { L1: number; L2: number; L3: number } };
  tier?: string;
}

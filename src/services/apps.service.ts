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

// ─── Apps API service — wraps /api/v1/apps/* endpoints ──────────────

import { api } from './api';
import type {
  InstalledApp,
  AppManifest,
  AppRuntimeStatus,
  ScanResult,
  InstallPayload,
  InstallResult,
  UninstallResult,
  AppsListResponse,
} from '@/types/apps';
import type { ApiResponse } from '@/types/api';

export interface AppsFilters {
  level?: string;
  status?: string;
  source?: string;
}

export async function getInstalledApps(
  filters?: AppsFilters,
): Promise<AppsListResponse> {
  return api.get<AppsListResponse>('/apps', {
    level: filters?.level,
    status: filters?.status,
    source: filters?.source,
  });
}

export async function getApp(
  name: string,
): Promise<InstalledApp & { manifest: AppManifest; runtime: AppRuntimeStatus | null }> {
  const res = await api.get<
    ApiResponse<InstalledApp & { manifest: AppManifest; runtime: AppRuntimeStatus | null }>
  >(`/apps/${name}`);
  return res.data;
}

export async function getAppStatuses(): Promise<AppRuntimeStatus[]> {
  const res = await api.get<ApiResponse<AppRuntimeStatus[]>>('/apps/status');
  return res.data;
}

export async function installApp(
  payload: InstallPayload,
): Promise<InstallResult> {
  const res = await api.post<{ data: InstallResult }>('/apps/install', payload);
  return res.data;
}

export async function updateAppStatus(
  name: string,
  status: 'active' | 'disabled',
): Promise<InstalledApp> {
  const res = await api.patch<ApiResponse<InstalledApp>>(`/apps/${name}`, { status });
  return res.data;
}

export async function uninstallApp(
  name: string,
  purge = false,
): Promise<UninstallResult> {
  const res = await api.delete<{ data: UninstallResult }>(
    `/apps/${name}${purge ? '?purge=true' : ''}`,
    purge ? { confirm_purge: true } : undefined,
  );
  return res.data;
}

export async function suggestForkName(name: string): Promise<string> {
  const res = await api.get<{ data: { suggested_name: string } }>(`/apps/${name}/suggest-fork-name`);
  return res.data.suggested_name;
}

export async function forkApp(name: string, newName: string): Promise<{ name: string; forked_from: string }> {
  const res = await api.post<{ data: { name: string; forked_from: string } }>(`/apps/${name}/fork`, { new_name: newName });
  return res.data;
}

export async function deleteApp(name: string): Promise<void> {
  await api.delete(`/apps/${name}`);
}

// ─── Adapted app file editing ────────────────────────────────────

export interface AppFile {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'dir';
}

export async function getAppFiles(name: string): Promise<AppFile[]> {
  const res = await api.get<{ data: AppFile[] }>(`/apps/${name}/files`);
  return res.data;
}

export async function getAppFileContent(name: string, filepath: string): Promise<string> {
  const res = await api.get<{ data: { content: string } }>(`/apps/${name}/files/${filepath}`);
  return res.data.content;
}

export async function saveAppFile(name: string, filepath: string, content: string): Promise<void> {
  await api.put(`/apps/${name}/files/${filepath}`, { content });
}

// ─── Scanning & export ──────────────────────────────────────────

export async function scanApp(name: string): Promise<ScanResult> {
  const res = await api.get<ApiResponse<ScanResult>>(`/apps/${name}/scan`);
  return res.data;
}

export async function exportApp(name: string): Promise<Blob> {
  const baseUrl = import.meta.env.VITE_API_URL ?? '';
  const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;

  const res = await fetch(`${baseUrl}/api/v1/apps/${name}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  return res.blob();
}

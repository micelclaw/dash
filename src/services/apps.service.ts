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

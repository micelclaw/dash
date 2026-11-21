import { api, ApiError } from '@/services/api';
import type { RecentDoc, OfficeApp } from '@/stores/office.store';
export type OfficeSlot = Exclude<OfficeApp, 'databases'>;
export interface OfficeProvider {
  app_name: string; version: string; slot: OfficeSlot; formats: string[]; operations: string[];
  collaboration: 'yjs' | 'ordered-log' | null; editor_url: string; preferred: boolean;
  license: string; source_url: string;
}
export interface OfficeProviders { providers: OfficeProvider[]; platform_ready: boolean; cutover: boolean }
export interface OfficeEditorSession {
  file_id: string; document_type: string; provider: string; editor_url: string;
  revision: string; writable: boolean; source_file_id?: string; converted?: boolean;
}
export async function getOfficeProviders(): Promise<OfficeProviders> {
  try { return (await api.get<{ data: OfficeProviders }>('/office/providers')).data; }
  catch (error) {
    // Existing Core versions remain functional until S01 loads the new contracts.
    if (error instanceof ApiError && error.status === 404) return { providers: [], platform_ready: false, cutover: false };
    throw error;
  }
}
export async function openOfficeDocument(fileId: string, provider?: string, options?: {destination?:{parent_folder:string};signal?:AbortSignal}): Promise<OfficeEditorSession> {
  return (await api.post<{ data: OfficeEditorSession }>(`/office/providers/open/${encodeURIComponent(fileId)}`, { ...(provider ? { provider } : {}), ...(options?.destination ? { destination:options.destination } : {}) },{signal:options?.signal,timeout:120000})).data;
}
export async function newOfficeDocument(provider: string): Promise<OfficeEditorSession> {
  return (await api.post<{ data: OfficeEditorSession }>(`/office/providers/${encodeURIComponent(provider)}/new`, {}, { timeout: 120000 })).data;
}
export function preferredProvider(list: OfficeProvider[], slot: OfficeSlot): OfficeProvider | undefined {
  const eligible = list.filter(p => p.slot === slot);
  return eligible.find(p => p.preferred);
}
export async function selectOfficeProvider(slot: OfficeSlot, app: string): Promise<void> {
  await api.put(`/office/providers/${slot}/preference`, { app_name: app });
}
export function officeFilenameSupported(filename: string, formats: readonly string[]): boolean {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 && formats.includes(filename.slice(dot + 1).toLowerCase());
}
/** Same two queries and deduplication as Drive Recent, then filter the app. */
export async function officeRecentFiles(slot: OfficeSlot, supportedFormats?: readonly string[]): Promise<RecentDoc[]> {
  const formats = supportedFormats ?? preferredProvider((await getOfficeProviders()).providers, slot)?.formats ?? [];
  if (!formats.length) return [];
  const [hot, earlier] = await Promise.all([
    api.get<{ data: (RecentDoc & { heat_score?: number })[] }>('/files', { sort: 'heat', order: 'desc', limit: 12, is_directory: false }),
    api.get<{ data: RecentDoc[] }>('/files', { sort: 'last_accessed', order: 'desc', limit: 60, is_directory: false }),
  ]);
  const seen = new Set<string>();
  return [...hot.data.filter(f => (f.heat_score ?? 0) > 0), ...earlier.data].filter(f => {
    if (seen.has(f.id)) return false; seen.add(f.id); return officeFilenameSupported(f.filename, formats);
  });
}

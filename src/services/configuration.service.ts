import { api } from './api';

export interface ConfigurationIssue { code: string; message: string; block?: string; adapter?: string }
export interface ConfigurationCatalog {
  format_version: 1;
  blocks: Array<{ id: string; label: string; authorized: boolean; available: boolean; reason?: string; fields?: unknown[] }>;
  coverage: { complete: boolean; issues: string[] };
  export?: { scope: 'personal' | 'instance'; available: boolean; reason?: string };
}
/** A capability read from the matching catalog never grants server authority.
 * Older personal catalogs remain usable; unknown instance readiness is closed. */
export function configurationExportReadiness(catalog: ConfigurationCatalog | null, scope: 'personal' | 'instance'): { available: boolean; reason?: string } {
  if (!catalog) return { available: false, reason: 'Actualiza la configuración para comprobar la exportación.' };
  if (catalog.export && catalog.export.scope !== scope) return { available: false, reason: 'Actualiza la configuración del ámbito seleccionado antes de exportar.' };
  if (scope === 'instance' && (catalog.export?.available !== true || catalog.coverage?.complete !== true)) {
    return { available: false, reason: catalog.export?.reason || 'La exportación de toda la instancia todavía no está disponible.' };
  }
  if (catalog.export && catalog.export.available !== true) return { available: false, reason: catalog.export.reason || 'La exportación no está disponible con esta sesión.' };
  return { available: true };
}
export interface ConfigurationSnapshot {
  revision: string; generated_at: string; scope: 'personal' | 'instance'; status: 'updated';
  blocks: Record<string, unknown>; warnings: ConfigurationIssue[];
}
export interface ConfigurationPreview {
  id: string; preview_revision: string;
  blocks: Array<{ id: string; label: string; present: boolean; compatible: boolean; authorized: boolean; selected: boolean; reason?: string }>;
  changes: Array<{ block: string; adapter: string; summary: string }>;
  preserved: string[]; omissions: ConfigurationIssue[]; blockers: ConfigurationIssue[]; warnings: ConfigurationIssue[];
  activation: string[]; can_apply: boolean;
  mapping_requests?: ConfigurationMappingRequest[];
  mappings?: ConfigurationMapping[];
}
export type ConfigurationMappingKind = 'user' | 'group' | 'agent' | 'connection' | 'application'
  | 'dns_provider' | 'ddns_provider' | 'dns_zone' | 'system_domain' | 'proxy_host'
  | 'proxy_certificate' | 'proxy_access_list' | 'vpn_peer' | 'vfs_mount' | 'protection_job' | 'storage_pool' | 'storage_dataset'
  | 'security_command_profile' | 'security_command_profile_version' | 'security_tool_profile'
  | 'email_account' | 'sync_connector' | 'oauth_credential' | 'approval_destination' | 'dns_native_zone' | 'avatar_resource' | 'shared_folder_resource' | 'observer_channel' | 'channel_binding' | 'native_mcp_server';
export interface ConfigurationMapping { kind: ConfigurationMappingKind; source_id: string; target_id: string }
export interface ConfigurationMappingRequest {
  kind: ConfigurationMappingKind; source_id: string; source_label?: string; message: string; required: boolean;
  candidates: Array<{ id: string; label: string }>;
}
export interface ImportOperation {
  id: string; status: 'draft' | 'prepared' | 'applying' | 'stopped' | 'completed' | 'cancelled';
  scope?: 'personal' | 'instance';
  created_at: string; updated_at: string; preview: ConfigurationPreview | null;
  results: Array<{ id: string; state: 'pending' | 'applying' | 'verified' | 'pending_activation' | 'failed' | 'uncertain' | 'omitted'; message: string; applied_adapters: string[] }>;
  control_only?: true;
  recovery?: ConfigurationRecoveryPoint;
}
export interface ConfigurationRecoveryPoint { id: string; created_at: string; scope: 'personal' | 'instance'; blocks: string[]; limitations: string[] }
export type ConfigurationReadableExport = {
  available: true; filename: string; media_type: 'application/json'; content: string; revision: string;
} | { available: false; issues: ConfigurationIssue[]; revision: string };
export interface ConfigurationExport { filename: string; file: string; warnings: ConfigurationIssue[]; readable?: ConfigurationReadableExport }
const data = async <T>(result: Promise<{ data: T }>) => (await result).data;
const operationPath = (id: string) => `/configuration/imports/${encodeURIComponent(id)}`;
export const configurationApi = {
  catalog: (scope: 'personal' | 'instance') => data(api.get<{ data: ConfigurationCatalog }>('/configuration/catalog', { scope })),
  snapshot: (scope: 'personal' | 'instance') => data(api.get<{ data: ConfigurationSnapshot }>('/configuration/snapshot', { scope }, { timeout: 60_000 })),
  export: (input: { blocks: string[]; password: string; scope: 'personal' | 'instance'; reauth_password?: string }) => data(api.post<{ data: ConfigurationExport }>('/configuration/export', input, { timeout: 120_000 })),
  open: (file: string, password: string) => data(api.post<{ data: ImportOperation }>('/configuration/imports/open', { file, password }, { timeout: 120_000 })),
  current: () => data(api.get<{ data: ImportOperation | null }>('/configuration/imports/current')),
  operation: (id: string) => data(api.get<{ data: ImportOperation }>(operationPath(id))),
  preview: (id: string, blocks: string[], mappings?: ConfigurationMapping[]) => data(api.post<{ data: ConfigurationPreview }>(`${operationPath(id)}/preview`, { blocks, ...(mappings ? { mappings } : {}) }, { timeout: 120_000 })),
  apply: (id: string, preview_revision: string, accept_activation: boolean) => data(api.post<{ data: ImportOperation }>(`${operationPath(id)}/apply`, { preview_revision, accept_activation }, { timeout: 120_000 })),
  retry: (id: string, preview_revision: string, accept_activation: boolean, continue_independent = false) => data(api.post<{ data: ImportOperation }>(`${operationPath(id)}/retry`, { preview_revision, accept_activation, continue_independent }, { timeout: 120_000 })),
  cancel: (id: string) => data(api.post<{ data: ImportOperation }>(`${operationPath(id)}/cancel`)),
  recovery: () => data(api.get<{ data: ConfigurationRecoveryPoint[] }>('/configuration/recovery')),
  openRecovery: (id: string) => data(api.post<{ data: ImportOperation }>(`/configuration/recovery/${encodeURIComponent(id)}/open`, {}, { timeout: 120_000 })),
};

/** Portable Claws exchange, with legacy Agentar import compatibility. */
import { api } from './api';

export interface AgentarValidationIssue { level: 'error' | 'warning'; code: string; message: string }
export interface AgentarValidationResult {
  format: 'claws' | 'agentar'; preview_hash: string;
  manifest: { spec_version: number; name: string; display_name: string; version: string; description?: string; model?: string; scopes: string[]; skills: string[]; is_chief: boolean };
  embedded_skills: string[]; file_count: number; valid: boolean; issues: AgentarValidationIssue[]; missing_skills: string[];
  files: Array<{ path: string; bytes: number; sha256: string }>; private_files: string[]; excluded_fields: string[]; permissions_granted: false;
}
export interface AgentarInstallResult {
  agent_id: string; token: string; format: 'claws' | 'agentar'; source_hash: string;
  installed_files: string[]; excluded_fields: string[]; permissions_granted: false;
  warnings: AgentarValidationIssue[]; missing_skills: string[];
}
export interface AgentImportSelection { preview_hash: string; name: string; include_user: boolean; include_memory: boolean; selected_skills: string[] }
export interface ClawsExportPreview { format: 'claws'; preview_hash: string; files: Array<{ path: string; bytes: number; sha256: string }>; excluded_fields: string[] }

export async function inspectClawsExport(agentId: string, selectedSkills: string[]): Promise<ClawsExportPreview> {
  return (await api.post<{ data: ClawsExportPreview }>(`/claws/preview/${encodeURIComponent(agentId)}`, { selected_skills: selectedSkills })).data;
}
export async function downloadClawsExport(agentId: string, preview: ClawsExportPreview, selectedSkills: string[]): Promise<{ blob: Blob; filename: string; sha256: string }> {
  const generated = (await api.post<{ data: { download_id: string; filename: string; sha256: string } }>(`/claws/export/${encodeURIComponent(agentId)}`, { selected_skills: selectedSkills, preview_hash: preview.preview_hash }, { timeout: 90_000 })).data;
  const downloaded = await api.getBlob(`/claws/download/${encodeURIComponent(generated.download_id)}`);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await downloaded.blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== generated.sha256) throw new Error('Downloaded package does not match its SHA-256 receipt. Generate it again.');
  return { blob: downloaded.blob, filename: generated.filename, sha256: generated.sha256 };
}
export async function validateAgentarPackage(file: File): Promise<AgentarValidationResult> {
  const fd = new FormData(); fd.append('package', file);
  return (await api.upload<{ data: AgentarValidationResult }>('/agentar/validate', fd, 'POST', { timeout: 90_000 })).data;
}
export async function installAgentarPackage(file: File, selection: AgentImportSelection): Promise<AgentarInstallResult> {
  const fd = new FormData();
  fd.append('preview_hash', selection.preview_hash); fd.append('name', selection.name);
  fd.append('include_user', String(selection.include_user)); fd.append('include_memory', String(selection.include_memory));
  fd.append('selected_skills', JSON.stringify(selection.selected_skills)); fd.append('package', file);
  return (await api.upload<{ data: AgentarInstallResult }>('/agentar/install', fd, 'POST', { timeout: 90_000 })).data;
}

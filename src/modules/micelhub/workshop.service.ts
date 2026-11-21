import { api } from '@/services/api';

export interface PersonalSkillEntry {
  skill_id: string; slug: string; name: string; description: string;
  owner_profile_id: string | null; owner_label: string; author_profile_id: string;
  shared: boolean; enabled: boolean; removed: boolean; revision: string;
  created_at: number; updated_at: number; can_edit: boolean;
}
export interface PersonalSkillFile { path: string; content: string; encoding?: 'utf8' | 'base64'; executable?: boolean }
export interface PersonalSkillDetail { entry: PersonalSkillEntry; content: string; files: PersonalSkillFile[]; revisions: Array<{ revision: string; created_at: number }> }
export interface PersonalSkillList { entries: PersonalSkillEntry[]; profile_id: string | null; multiple_profiles: boolean; default_target: 'personal' | 'workspace' | 'unavailable'; session?: { selections: Array<{ skill_id: string; revision: string; name: string }> } }
export interface PersonalSkillSave { expected_revision: string | null; slug: string; content: string; files?: PersonalSkillFile[]; retain_files?: string[]; remove_files?: string[] }
export type LibraryAction = 'share' | 'unshare' | 'transfer' | 'remove' | 'enable' | 'disable' | 'rollback';
export interface WorkshopSkill { name: string; description?: string; files?: string[]; size_bytes?: number; updated_at_ms?: number; use_count?: number; last_used_at_ms?: number }
export interface WorkshopVersion { id: string; created_at_ms?: number }
export interface WorkshopArchive { name: string; live: boolean; versions: WorkshopVersion[] }
export interface WorkshopSnapshot { agent_id: string; mode: 'off' | 'auto'; skills: WorkshopSkill[]; archived: WorkshopArchive[] }
export interface WorkshopChange { id: string; skill_name: string; action: 'create' | 'patch' | 'write_file' | 'remove_file' | 'archive' | 'restore'; actor: string; summary: string; version_id?: string; created_at_ms: number }
export interface WorkshopRead { name: string; file_path: string; content: string; files: string[] }
export interface WorkshopAgent { id: string; name: string; display_name: string }
export interface OwnConversation { conversation_id: string; first_message?: string; agent?: string; access: 'owner' | 'participant' | 'viewer' | 'admin' }

const path = (id: string) => `/skill-library/${encodeURIComponent(id)}`;
export const workshopService = {
  async library(scope: 'mine' | 'team', signal?: AbortSignal) { return (await api.get<{ data: PersonalSkillList }>('/skill-library', { scope }, { signal })).data; },
  async read(id: string, revision?: string) { return (await api.get<{ data: PersonalSkillDetail }>(path(id), { revision })).data; },
  async save(body: PersonalSkillSave, id?: string) {
    return (id ? await api.put<{ data: { entry: PersonalSkillEntry; next_action: string } }>(path(id), body)
      : await api.post<{ data: { entry: PersonalSkillEntry; next_action: string } }>('/skill-library', body)).data;
  },
  async mutate(entry: PersonalSkillEntry, action: LibraryAction, revision?: string) {
    return (await api.post<{ data: { entry: PersonalSkillEntry; next_action: string } }>(`${path(entry.skill_id)}/actions`, { action, expected_revision: entry.revision, ...(revision ? { revision } : {}) })).data;
  },
  async importClawHub(slug: string, sourceSlug: string, version?: string) { return (await api.post<{ data: { entry: PersonalSkillEntry; next_action: string } }>('/skill-library/import', { slug, source: { kind: 'clawhub', slug: sourceSlug, ...(version ? { version } : {}) } }, { timeout: 120_000 })).data; },
  async importZip(slug: string, file: File) {
    if (!file.size || file.size > 8_388_608) throw new Error('Selecciona un ZIP de hasta 8 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
    const opened = (await api.post<{ data: { upload_id: string; offset: number; max_chunk_bytes: number } }>('/skill-library/uploads', { action: 'begin', slug, size_bytes: bytes.length, sha256: hash })).data;
    if (!opened.upload_id || opened.offset !== 0 || !Number.isInteger(opened.max_chunk_bytes) || opened.max_chunk_bytes < 1) throw new Error('El servidor no ha confirmado la importación.');
    let offset = opened.offset;
    while (offset < bytes.length) {
      const end = Math.min(offset + Math.min(opened.max_chunk_bytes, 245_760), bytes.length);
      let binary = ''; const chunk = bytes.subarray(offset, end);
      for (let i = 0; i < chunk.length; i += 8_192) binary += String.fromCharCode(...chunk.subarray(i, i + 8_192));
      const ack = (await api.post<{ data: { offset: number } }>('/skill-library/uploads', { action: 'chunk', upload_id: opened.upload_id, offset, data: btoa(binary) })).data;
      if (ack.offset !== end) throw new Error('El acuse de subida no coincide. Consulta la biblioteca antes de reintentar.');
      offset = ack.offset;
    }
    return (await api.post<{ data: { entry: PersonalSkillEntry; next_action: string } }>('/skill-library/uploads', { action: 'commit', upload_id: opened.upload_id }, { timeout: 120_000 })).data;
  },
  async conversations() { return (await api.get<{ data: OwnConversation[] }>('/conversations/threads', { limit: 100 })).data.filter((item) => item.access === 'owner'); },
  async activate(conversationId: string, skillId: string, action: 'attach' | 'detach' | 'refresh', revision?: string) {
    return (await api.post<{ data: unknown }>(`/conversations/${encodeURIComponent(conversationId)}/skill-selections`, { action, skill_id: skillId, ...(revision ? { revision } : {}) })).data;
  },
  async agents() { return (await api.get<{ data: WorkshopAgent[] }>('/managed-agents')).data; },
  async learned(agentId: string, signal?: AbortSignal) { return (await api.get<{ data: { workshop: WorkshopSnapshot; projection_synced: boolean } }>(`/managed-agents/${encodeURIComponent(agentId)}/workshop`, undefined, { signal })).data; },
  async changes(agentId: string) { return (await api.get<{ data: { changes: WorkshopChange[] } }>(`/managed-agents/${encodeURIComponent(agentId)}/workshop/changes`, { limit: 100 })).data.changes; },
  async skill(agentId: string, name: string, options: { file_path?: string; version_id?: string } = {}) { return (await api.get<{ data: WorkshopRead }>(`/managed-agents/${encodeURIComponent(agentId)}/workshop/skills/${encodeURIComponent(name)}`, options)).data; },
  async archive(agentId: string, name: string) { return (await api.post<{ data: { projection_synced: boolean } }>(`/managed-agents/${encodeURIComponent(agentId)}/workshop/skills/${encodeURIComponent(name)}/archive`, {})).data; },
  async restore(agentId: string, name: string, versionId?: string) { return (await api.post<{ data: { projection_synced: boolean } }>(`/managed-agents/${encodeURIComponent(agentId)}/workshop/skills/${encodeURIComponent(name)}/restore`, versionId ? { version_id: versionId } : {})).data; },
  async setMode(mode: 'off' | 'auto') { return (await api.patch<{ data: { mode: 'off' | 'auto' } }>('/gateway/skill-workshop-config', { mode })).data; },
};

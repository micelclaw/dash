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

import { api } from './api';

export type FolderPermission = 'none' | 'ro' | 'rw' | 'custom';

export interface SharedFolder {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  recycle_bin: boolean;
  hidden: boolean;
  created_at: string;
  // Unificación P2 (un solo tipo de carpeta compartida)
  backend: 'managed' | 'host_bind';
  host_path: string | null;
  read_only: boolean;
  status: 'pending' | 'indexing' | 'active' | 'error';
  last_indexed_at: string | null;
  last_error: string | null;
  index_in_drive: boolean;
  protocols: Record<string, { enabled: boolean; settings?: Record<string, unknown> }>;
  // Fase 4: opciones avanzadas (estilo Synology)
  quota_bytes: number | null;
  access_based_enum: boolean;
  deny_browse: boolean;
  deny_modify: boolean;
  deny_download: boolean;
}

export interface UserFolderPerm {
  id: string;
  name: string;
  permission: FolderPermission;          // permiso DIRECTO del usuario (editable)
  group_permission?: FolderPermission;   // Fase 2: heredado de grupos (read-only)
}

export async function listSharedFolders(): Promise<SharedFolder[]> {
  const res = await api.get<{ data: SharedFolder[] }>('/shared-folders');
  return res.data;
}

export async function createSharedFolder(input: {
  name: string; description?: string; recycle_bin?: boolean; hidden?: boolean;
  backend?: 'managed' | 'host_bind'; host_path?: string; read_only?: boolean; index_in_drive?: boolean;
  access_based_enum?: boolean;
  quota_bytes?: number | null; deny_browse?: boolean; deny_modify?: boolean; deny_download?: boolean;
}): Promise<SharedFolder> {
  const res = await api.post<{ data: SharedFolder }>('/shared-folders', input);
  return res.data;
}

/** Lista de sujetos (usuarios+grupos) SIN carpeta, todos 'none' — para pre-asignar
 *  permisos en el diálogo de CREAR (misma forma que getFolderAccess). */
export async function getFolderSubjects(): Promise<FolderAccess> {
  const res = await api.get<{ data: FolderAccess }>('/shared-folders/subjects');
  return res.data;
}

/** Edita las propiedades de la carpeta (General/Avanzada/Permisos avanzados). */
export async function updateSharedFolder(id: string, patch: {
  name?: string; description?: string; recycle_bin?: boolean; hidden?: boolean;
  read_only?: boolean; index_in_drive?: boolean;
  quota_bytes?: number | null; access_based_enum?: boolean;
  deny_browse?: boolean; deny_modify?: boolean; deny_download?: boolean;
}): Promise<SharedFolder> {
  const res = await api.patch<{ data: SharedFolder }>(`/shared-folders/${id}`, patch);
  return res.data;
}

/** Uso de la carpeta (bytes usados + cuota) — indicador "X usado" de Avanzada. */
export async function getFolderUsage(id: string): Promise<{ used_bytes: number; quota_bytes: number | null }> {
  const res = await api.get<{ data: { used_bytes: number; quota_bytes: number | null } }>(`/shared-folders/${id}/usage`);
  return res.data;
}

/** Vacía la papelera de reciclaje de la carpeta (.recycle de Samba + índice). */
export async function emptyRecycleBin(id: string): Promise<void> {
  await api.post(`/shared-folders/${id}/recycle/empty`, {});
}

/** Toggles de protocolos de red por carpeta (P3-F0). Merge por clave en el backend. */
export async function updateSharedFolderProtocols(
  id: string,
  protocols: Record<string, { enabled?: boolean; settings?: Record<string, unknown> }>,
): Promise<SharedFolder['protocols']> {
  const res = await api.patch<{ data: { protocols: SharedFolder['protocols'] } }>(`/shared-folders/${id}/protocols`, protocols);
  return res.data.protocols;
}

/** Re-indexa la carpeta en el Drive (fs → índice). */
export async function reindexSharedFolder(id: string): Promise<{ created: number; updated: number; removed: number; total: number } | { skipped: true }> {
  const res = await api.post<{ data: { created: number; updated: number; removed: number; total: number } | { skipped: true } }>(`/shared-folders/${id}/index`, {});
  return res.data;
}

// ─── P3 multi-protocolo ───
export interface ProtocolStatus {
  sshd: boolean; exportfs: boolean; rrsync: boolean;
  sftp_root: boolean; dropin: boolean; keys_dir: boolean;
  unavailable?: true;
  // Metadatos de acceso por red (fusionados server-side; ver getNetworkAccessMeta).
  smb_port?: number;
  smb_enabled?: boolean;
  smb_running?: boolean;
  windows_native?: boolean;      // ¿SMB montable desde el Explorador de Windows? (445 + activo + corriendo)
  primary_domain?: string;
  webdav_base_url?: string;      // https://<dominio>/webdav
  environment?: string;          // bare-metal | wsl2 | vm | container | preview | unknown
}
export async function getProtocolStatus(): Promise<ProtocolStatus> {
  const res = await api.get<{ data: ProtocolStatus }>('/network/protocols/status');
  return res.data;
}

/** Emite una CREDENCIAL DE ARCHIVOS (device token hex64) para montar por WebDAV.
 *  Necesaria para usuarios con 2FA (Basic no hace TOTP) o quien prefiera un token
 *  revocable en vez de su contraseña. Reutiliza el emparejamiento de dispositivos
 *  (ADR-14). El token solo se muestra UNA vez. */
export async function createFileAccessCredential(deviceName: string): Promise<string> {
  const res = await api.post<{ data: { device_token: string } }>('/devices/register', {
    platform: 'desktop', device_name: deviceName,
  });
  return res.data.device_token;
}

/** Claves SSH públicas del usuario (para SFTP / rsync-over-SSH). */
export async function getSshKeys(): Promise<string[]> {
  const res = await api.get<{ data: { keys: string[] } }>('/network/ssh-keys');
  return res.data.keys;
}
export async function setSshKeys(keys: string[]): Promise<string[]> {
  const res = await api.put<{ data: { keys: string[] } }>('/network/ssh-keys', { keys });
  return res.data.keys;
}

export async function deleteSharedFolder(id: string): Promise<void> {
  await api.delete(`/shared-folders/${id}`);
}

/** Permisos de un usuario sobre todas las carpetas (pestaña "Permisos"). */
export async function getUserFolderAccess(userId: string): Promise<UserFolderPerm[]> {
  const res = await api.get<{ data: { folders: UserFolderPerm[] } }>(`/admin/users/${userId}/folder-access`);
  return res.data.folders;
}

export async function updateUserFolderAccess(userId: string, folders: Record<string, FolderPermission>): Promise<void> {
  await api.patch(`/admin/users/${userId}/folder-access`, { folders });
}

// ─── Permisos DESDE la carpeta (pestaña Permisos del diálogo de la carpeta) ───
export interface FolderAccessUser { id: string; name: string; is_admin: boolean; permission: FolderPermission; }
export interface FolderAccessGroup { id: string; name: string; permission: FolderPermission; }
export interface FolderAccess { users: FolderAccessUser[]; groups: FolderAccessGroup[]; }

/** Todos los usuarios y grupos con su permiso DIRECTO sobre esta carpeta (estilo Synology). */
export async function getFolderAccess(folderId: string): Promise<FolderAccess> {
  const res = await api.get<{ data: FolderAccess }>(`/shared-folders/${folderId}/access`);
  return res.data;
}

/** Fija el permiso de un sujeto (usuario/grupo) sobre una carpeta. 'none' lo elimina. */
export async function setFolderAcl(
  folderId: string,
  subject: { subject_type: 'user' | 'group'; subject_id: string; permission: FolderPermission },
): Promise<void> {
  await api.put(`/shared-folders/${folderId}/acl`, subject);
}

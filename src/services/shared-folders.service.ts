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
}

export interface UserFolderPerm { id: string; name: string; permission: FolderPermission; }

export async function listSharedFolders(): Promise<SharedFolder[]> {
  const res = await api.get<{ data: SharedFolder[] }>('/shared-folders');
  return res.data;
}

export async function createSharedFolder(input: { name: string; description?: string; recycle_bin?: boolean; hidden?: boolean }): Promise<SharedFolder> {
  const res = await api.post<{ data: SharedFolder }>('/shared-folders', input);
  return res.data;
}

export async function deleteSharedFolder(id: string): Promise<void> {
  await api.delete(`/shared-folders/${id}`);
}

/** Permisos de un usuario sobre todas las carpetas (pestaña "Permisos"). */
export async function getUserFolderAccess(userId: string): Promise<UserFolderPerm[]> {
  const res = await api.get<{ data: { folders: UserFolderPerm[] } }>(`/admin/users/${userId}/folder-access`);
  return res.data.folders;
}

export async function patchUserFolderAccess(userId: string, folders: Record<string, FolderPermission>): Promise<void> {
  await api.patch(`/admin/users/${userId}/folder-access`, { folders });
}

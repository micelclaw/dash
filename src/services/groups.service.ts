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
import type { FolderPermission, UserFolderPerm } from './shared-folders.service';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
}

export interface UserGroup { id: string; name: string; is_system: boolean; member: boolean; }

export async function listGroups(): Promise<Group[]> {
  const res = await api.get<{ data: Group[] }>('/groups');
  return res.data;
}
export async function createGroup(input: { name: string; description?: string }): Promise<Group> {
  const res = await api.post<{ data: Group }>('/groups', input);
  return res.data;
}
export async function deleteGroup(id: string): Promise<void> { await api.delete(`/groups/${id}`); }

export async function getGroupMembers(id: string): Promise<string[]> {
  const res = await api.get<{ data: { members: string[] } }>(`/groups/${id}/members`);
  return res.data.members;
}
export async function patchGroupMembers(id: string, members: Record<string, boolean>): Promise<void> {
  await api.patch(`/groups/${id}/members`, { members });
}

export async function getGroupAppAccess(id: string): Promise<{ key: string; allowed: boolean }[]> {
  const res = await api.get<{ data: { apps: { key: string; allowed: boolean }[] } }>(`/groups/${id}/app-access`);
  return res.data.apps;
}
export async function patchGroupAppAccess(id: string, apps: Record<string, boolean>): Promise<void> {
  await api.patch(`/groups/${id}/app-access`, { apps });
}

export async function getGroupFolderAccess(id: string): Promise<UserFolderPerm[]> {
  const res = await api.get<{ data: { folders: UserFolderPerm[] } }>(`/groups/${id}/folder-access`);
  return res.data.folders;
}
export async function patchGroupFolderAccess(id: string, folders: Record<string, FolderPermission>): Promise<void> {
  await api.patch(`/groups/${id}/folder-access`, { folders });
}

// Membresía vista desde el usuario (pestaña "Grupos de usuarios").
export async function getUserGroups(userId: string): Promise<UserGroup[]> {
  const res = await api.get<{ data: { groups: UserGroup[] } }>(`/admin/users/${userId}/groups`);
  return res.data.groups;
}
export async function patchUserGroups(userId: string, groups: Record<string, boolean>): Promise<void> {
  await api.patch(`/admin/users/${userId}/groups`, { groups });
}

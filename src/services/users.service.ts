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
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from '@/types/users';

export async function listUsers(): Promise<AdminUser[]> {
  const res = await api.get<{ data: AdminUser[] }>('/admin/users');
  return res.data;
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const res = await api.post<{ data: AdminUser }>('/admin/users', payload);
  return res.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const res = await api.patch<{ data: AdminUser }>(`/admin/users/${id}`, payload);
  return res.data;
}

export async function setUserPassword(id: string, newPassword: string): Promise<void> {
  await api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword });
}

export async function generateResetLink(id: string): Promise<{ reset_url: string; email: string }> {
  const res = await api.post<{ data: { reset_url: string; email: string } }>(`/admin/users/${id}/reset-link`);
  return res.data;
}

export async function suspendUser(id: string): Promise<AdminUser> {
  const res = await api.post<{ data: AdminUser }>(`/admin/users/${id}/suspend`);
  return res.data;
}

export async function reactivateUser(id: string): Promise<AdminUser> {
  const res = await api.post<{ data: AdminUser }>(`/admin/users/${id}/reactivate`);
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`);
}

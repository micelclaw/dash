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

export interface UserAppAccessState {
  is_admin: boolean;
  apps: { key: string; allowed: boolean; group_allowed?: boolean }[];
}

/** Apps que el usuario actual puede ver (para el gating del dash). */
export async function getMyAppAccess(): Promise<string[]> {
  const res = await api.get<{ data: { allowed: string[] } }>('/me/app-access');
  return res.data.allowed;
}

/** Estado por app opt_in de un usuario (admin) — para la matriz de permisos. */
export async function getUserAppAccess(userId: string): Promise<UserAppAccessState> {
  const res = await api.get<{ data: UserAppAccessState }>(`/admin/users/${userId}/app-access`);
  return res.data;
}

/** Fija allow/deny por app opt_in de un usuario (admin). Devuelve el allowed efectivo. */
export async function patchUserAppAccess(userId: string, apps: Record<string, boolean>): Promise<string[]> {
  const res = await api.patch<{ data: { allowed: string[] } }>(`/admin/users/${userId}/app-access`, { apps });
  return res.data.allowed;
}

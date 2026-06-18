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

export interface UserQuota { quota_bytes: number; effective_bytes: number; used_bytes: number; }

export async function getUserQuota(userId: string): Promise<UserQuota> {
  const res = await api.get<{ data: UserQuota }>(`/admin/users/${userId}/quota`);
  return res.data;
}

export async function patchUserQuota(userId: string, quotaBytes: number): Promise<void> {
  await api.patch(`/admin/users/${userId}/quota`, { quota_bytes: quotaBytes });
}

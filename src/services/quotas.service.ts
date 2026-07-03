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

export interface UserQuota {
  quota_bytes: number;       // override directo del usuario (0 = sin override)
  user_bytes?: number;       // alias explícito de quota_bytes
  group_bytes?: number;      // cuota heredada de sus grupos
  effective_bytes: number;   // efectiva (user∪grupos)
  used_bytes: number;
}

export async function getUserQuota(userId: string): Promise<UserQuota> {
  const res = await api.get<{ data: UserQuota }>(`/admin/users/${userId}/quota`);
  return res.data;
}

export async function updateUserQuota(userId: string, quotaBytes: number): Promise<void> {
  await api.patch(`/admin/users/${userId}/quota`, { quota_bytes: quotaBytes });
}

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

export interface UserSpeedLimit {
  service: string;
  up_kbps: number;          // override directo (0 = sin override → hereda/ilimitado)
  down_kbps: number;
  effective_up_kbps: number;
  effective_down_kbps: number;
}

export async function getUserSpeedLimits(userId: string): Promise<UserSpeedLimit> {
  const res = await api.get<{ data: UserSpeedLimit }>(`/admin/users/${userId}/speed-limits`);
  return res.data;
}

export async function patchUserSpeedLimits(userId: string, upKbps: number, downKbps: number): Promise<void> {
  await api.patch(`/admin/users/${userId}/speed-limits`, { up_kbps: upKbps, down_kbps: downKbps });
}

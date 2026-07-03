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
  up_kbps: number;          // override directo 'files' (0 = sin override → hereda/ilimitado)
  down_kbps: number;
  effective_up_kbps: number;
  effective_down_kbps: number;
  media_down_kbps: number;            // NAS3b: límite 'media' (solo bajada)
  effective_media_down_kbps: number;
  has_override?: boolean;             // Fase 2: ¿override propio o hereda de grupos?
}

export async function getUserSpeedLimits(userId: string): Promise<UserSpeedLimit> {
  const res = await api.get<{ data: UserSpeedLimit }>(`/admin/users/${userId}/speed-limits`);
  return res.data;
}

/** Modo "personalizar": fija el override del usuario. */
export async function updateUserSpeedLimits(userId: string, upKbps: number, downKbps: number, mediaDownKbps: number): Promise<void> {
  await api.patch(`/admin/users/${userId}/speed-limits`, { mode: 'custom', up_kbps: upKbps, down_kbps: downKbps, media_down_kbps: mediaDownKbps });
}

/** Modo "aplicar configuración de grupo": borra el override → hereda de sus grupos. */
export async function clearUserSpeedLimits(userId: string): Promise<void> {
  await api.patch(`/admin/users/${userId}/speed-limits`, { mode: 'group' });
}

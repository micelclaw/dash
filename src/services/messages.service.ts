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

// ─── Messages service ───────────────────────────────────────────────
//
// Wraps `/api/v1/messages/*` endpoints. Currently just the per-platform
// stats summary used by ChannelObserversSection (count of channels
// + messages observed per platform: slack, discord, telegram, etc.).

import { api } from './api';

export interface PlatformStats {
  platform: string;
  channel_count: number;
  message_count: number;
}

export async function getPlatformStats(): Promise<PlatformStats[]> {
  const res = await api.get<{ data: PlatformStats[] }>('/messages/platforms');
  return res.data ?? [];
}

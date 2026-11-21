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

// ─── API keys service ───────────────────────────────────────────────
//
// Wraps `/api/v1/api-keys/*` (user-owned API keys, distinct from
// agent tokens). Used by MyApiKeysSection.

import { api } from './api';

export interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  /** Authentication scope from Core; not a granular permission-grant list. */
  scope: string;
  last_used_at: string | null;
  created_at: string;
}

export async function listMyApiKeys(): Promise<ApiKey[]> {
  const res = await api.get<{ data: ApiKey[] }>('/api-keys/mine');
  return res.data ?? [];
}

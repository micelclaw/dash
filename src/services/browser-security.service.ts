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

// ─── Browser-security settings service ──────────────────────────────
//
// Wraps `/api/v1/settings/browser-security` (per-user browser policy
// — internet on/off, allowlist/denylist, web auth, isolation). Used
// by SearchSection. Distinct from `/gateway/browser-config` which
// configures the OpenClaw browser process itself.

import { api } from './api';

export interface BrowserSecurityConfig {
  internet_access: boolean;
  local_network_access: boolean;
  local_network_allowlist: string[];
  domain_denylist: string[];
  allow_web_auth: boolean;
  isolated_sessions: boolean;
  persist_sessions: boolean;
}

export async function getBrowserSecurity(): Promise<BrowserSecurityConfig> {
  const res = await api.get<{ data: BrowserSecurityConfig }>('/settings/browser-security');
  return res.data;
}

export async function updateBrowserSecurity(
  patch: Partial<BrowserSecurityConfig>,
): Promise<BrowserSecurityConfig> {
  const res = await api.patch<{ data: BrowserSecurityConfig }>(
    '/settings/browser-security',
    patch,
  );
  return res.data;
}

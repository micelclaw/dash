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

// ─── Digest service ─────────────────────────────────────────────────
//
// Wraps `/api/v1/digest/config` and the `/api/v1/email-accounts` list
// used by DigestSection (the email-accounts list is shown in the
// digest section's "deliver via email" picker so it lives here for
// proximity).

import { api } from './api';

export interface DigestConfig {
  enabled: boolean;
  interval_minutes: number;
  quiet_hours: { start: string; end: string } | null;
  domains: string[] | null;
  channels?: string[];
  alert_levels?: string[];
  email_digest?: {
    account_id: string;
    recipient: string;
    interval_minutes: number;
  } | null;
}

export interface EmailAccountOption {
  id: string;
  email_address: string;
  name: string;
}

export async function getDigestConfig(): Promise<DigestConfig> {
  const res = await api.get<{ data: DigestConfig }>('/digest/config');
  return res.data;
}

export async function updateDigestConfig(patch: Partial<DigestConfig>): Promise<DigestConfig> {
  const res = await api.patch<{ data: DigestConfig }>('/digest/config', patch);
  return res.data;
}

export async function listEmailAccounts(): Promise<EmailAccountOption[]> {
  const res = await api.get<{ data: EmailAccountOption[] }>('/email-accounts');
  return res.data ?? [];
}

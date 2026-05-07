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

// ─── Email accounts service ─────────────────────────────────────────
//
// Wraps `/api/v1/email-accounts/*` (CRUD on IMAP/SMTP account
// definitions). Read-only listing via `digest.service.ts`
// (`listEmailAccounts`) for the digest section's email-sender
// picker; this file holds the mutation endpoints used by IMAP form
// + connector edit modal.

import { api } from './api';

/** Generic shape — concrete fields vary by provider; consumers narrow as needed. */
export type EmailAccountDetail = Record<string, unknown> & { id: string };

export async function getEmailAccount(id: string): Promise<EmailAccountDetail> {
  const res = await api.get<{ data: EmailAccountDetail }>(`/email-accounts/${id}`);
  return res.data;
}

export async function createEmailAccount(body: Record<string, unknown>): Promise<EmailAccountDetail> {
  const res = await api.post<{ data: EmailAccountDetail }>('/email-accounts', body);
  return res.data;
}

export async function updateEmailAccount(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/email-accounts/${id}`, patch);
}

/** Test the IMAP/SMTP connection of an existing account. */
export async function testEmailAccount(id: string): Promise<{ success: boolean }> {
  const res = await api.post<{ data: { success: boolean } }>(`/email-accounts/${id}/test`);
  return res.data;
}

/** List the IMAP folders available on an existing account. */
export async function listEmailFolders(id: string): Promise<string[]> {
  const res = await api.get<{ data: string[] }>(`/email-accounts/${id}/folders`);
  return res.data ?? [];
}

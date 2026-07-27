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

/**
 * Resultado de probar una cuenta.
 *
 * El contrato cambió cuando el endpoint dejó de mentir: antes devolvía
 * `{success:true}` con una lista de carpetas inventada SIN abrir un socket.
 * Ahora informa por protocolo, y cuando falla dice la CAUSA (`kind`) y qué hacer
 * (`hint`) — que es lo que hay que enseñar al usuario en vez de un aspa roja.
 */
export interface ProtocolTestResult {
  status: 'ok' | 'error';
  duration_ms: number;
  /** Solo en IMAP y solo si fue bien: las carpetas que dijo EL SERVIDOR. */
  folders_found?: string[];
  /** Causa clasificada: auth · tls_cert · dns · refused · timeout · blocked… */
  kind?: string;
  hint?: string;
  detail?: string;
}

export interface AccountTestResult {
  imap: ProtocolTestResult;
  smtp: ProtocolTestResult;
}

/** Prueba REAL de la conexión: LOGIN + LIST contra IMAP y AUTH contra SMTP. */
export async function testEmailAccount(id: string): Promise<AccountTestResult> {
  const res = await api.post<{ data: AccountTestResult }>(`/email-accounts/${id}/test`);
  return res.data;
}

/**
 * Las carpetas que existen EN EL SERVIDOR. Devuelve nombres para que el
 * llamante no cambie, pero ojo: el endpoint ya no inventa nada — si no hay
 * conexión válida responde 502 con la causa, y esto lanza.
 */
export async function listEmailFolders(id: string): Promise<string[]> {
  const res = await api.get<{ data: { folders: { name: string }[] } }>(`/email-accounts/${id}/folders`);
  return (res.data?.folders ?? []).map((f) => f.name);
}

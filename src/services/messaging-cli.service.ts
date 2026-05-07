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

// ─── Messaging CLI services ─────────────────────────────────────────
//
// Wraps `/api/v1/signal-cli/*` and `/api/v1/simplex-chat/*` endpoints
// used by AddIntegrationModal to bootstrap Signal/SimpleX observers.
// These domains expose lifecycle (start), status, and pairing flows
// (link / link-check / accounts).

import { api } from './api';

// ─── Signal CLI ────────────────────────────────────────────────────

export interface SignalCliStatus {
  running: boolean;
  url: string | null;
}

export async function getSignalStatus(): Promise<SignalCliStatus> {
  const res = await api.get<{ data: SignalCliStatus }>('/signal-cli/status');
  return res.data;
}

export async function startSignal(): Promise<SignalCliStatus> {
  const res = await api.post<{ data: SignalCliStatus }>('/signal-cli/start');
  return res.data;
}

export async function listSignalAccounts(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/signal-cli/accounts');
  return res.data ?? [];
}

export async function linkSignal(): Promise<{ qr_uri: string }> {
  const res = await api.post<{ data: { qr_uri: string } }>('/signal-cli/link');
  return res.data;
}

export async function checkSignalLink(phoneNumber: string): Promise<{ linked: boolean }> {
  const res = await api.post<{ data: { linked: boolean } }>('/signal-cli/link-check', {
    phone_number: phoneNumber,
  });
  return res.data;
}

// ─── SimpleX Chat ──────────────────────────────────────────────────

export interface SimplexStatus {
  running: boolean;
  url: string | null;
}

export async function getSimplexStatus(): Promise<SimplexStatus> {
  const res = await api.get<{ data: SimplexStatus }>('/simplex-chat/status');
  return res.data;
}

export async function startSimplex(): Promise<SimplexStatus> {
  const res = await api.post<{ data: SimplexStatus }>('/simplex-chat/start');
  return res.data;
}

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

// ─── SimpleX · identidad propia — capa de conexión (perfil dedicado) ───────────
// El perfil vive en el servidor: renombrar + dirección/QR (para que te añadan) +
// auto-aceptar + conectar con el enlace de otro. Endpoints en core/routes/simplex-chat.ts.

/** Renombra el perfil (display name con el que te ven tus contactos). */
export async function setSimplexProfile(name: string): Promise<void> {
  await api.post('/simplex-chat/profile', { name });
}

/** Tu dirección SimpleX (get-or-create). La compartes para que te añadan. */
export async function getSimplexAddress(): Promise<{ address: string | null }> {
  const res = await api.get<{ data: { address: string | null } }>('/simplex-chat/address');
  return res.data;
}

/** Auto-aceptar solicitudes de contacto sobre tu dirección. */
export async function setSimplexAutoAccept(enabled: boolean): Promise<void> {
  await api.post('/simplex-chat/auto-accept', { enabled });
}

/** Conectar con alguien usando SU enlace de invitación (simplex:/...). */
export async function connectSimplexLink(link: string): Promise<void> {
  await api.post('/simplex-chat/connect', { link });
}

// ─── SimpleX · tu móvil (XRCP) ──────────────────────────────────────
// El puente XRCP (sidecar Rust) enruta a la identidad del teléfono. Endpoints en
// core/routes/simplex-xrcp.ts. El emparejamiento vive en el sidecar (QR + código).

export interface XrcpServiceStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  pairing?: {
    paired: boolean;
    connected: boolean;
    host_name: string | null;
    known_host: string | null;
    pairing?: { active: boolean; invitation: string | null; session_code: string | null } | null;
  } | null;
}

export interface XrcpPairState {
  paired: boolean;
  connected: boolean;
  host_name: string | null;
  known_host: string | null;
  pairing?: { active: boolean; invitation: string | null; session_code: string | null } | null;
}

// Timeouts largos: el arranque/emparejamiento toca Docker (collect/stats sobre
// decenas de contenedores) → puede tardar más que el default de 15s del dash.
export async function getSimplexXrcpStatus(): Promise<XrcpServiceStatus> {
  const res = await api.get<{ data: XrcpServiceStatus }>('/simplex-xrcp/status', undefined, { timeout: 30_000 });
  return res.data;
}

export async function startSimplexXrcp(): Promise<XrcpServiceStatus> {
  const res = await api.post<{ data: XrcpServiceStatus }>('/simplex-xrcp/start', undefined, { timeout: 90_000 });
  return res.data;
}

/** Inicia el emparejamiento: devuelve el QR (xrcp://…) + código de sesión. */
export async function pairStartSimplexXrcp(): Promise<{ invitation: string; session_code: string | null }> {
  const res = await api.post<{ data: { invitation: string; session_code: string | null } }>('/simplex-xrcp/pair/start', undefined, { timeout: 90_000 });
  return res.data;
}

/** Poll del emparejamiento: ¿ya conectó el móvil? */
export async function pairStatusSimplexXrcp(): Promise<XrcpPairState> {
  const res = await api.get<{ data: XrcpPairState }>('/simplex-xrcp/pair/status', undefined, { timeout: 30_000 });
  return res.data;
}

// ─── Session (Oxen) ─────────────────────────────────────────────────
// Las DOS tarjetas («identidad propia» = crear · «tu móvil» = importar la frase)
// comparten el sidecar Bun. Endpoints en core/routes/session.ts.

export interface SessionServiceStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
}

export interface SessionIdentity {
  session_id: string;
  mnemonic: string;
}

export async function getSessionStatus(): Promise<SessionServiceStatus> {
  const res = await api.get<{ data: SessionServiceStatus }>('/session/status');
  return res.data;
}

export async function startSession(): Promise<SessionServiceStatus> {
  const res = await api.post<{ data: SessionServiceStatus }>('/session/start');
  return res.data;
}

/**
 * Crea (mode='create') o importa (mode='import' + mnemonic) una identidad de
 * Session. Devuelve el Session ID (05…) + la frase de recuperación.
 */
export async function createSessionIdentity(
  mode: 'create' | 'import',
  displayName?: string,
  mnemonic?: string,
): Promise<SessionIdentity> {
  const res = await api.post<{ data: SessionIdentity }>('/session/identity', {
    mode,
    display_name: displayName,
    mnemonic,
  });
  return res.data;
}

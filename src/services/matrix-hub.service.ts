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

/**
 * Hub Matrix — tus cuentas REALES (no bots) vía bridges mautrix.
 *
 * Multi-bridge desde 2026-07-17: telegram (teléfono → código → 2FA) y whatsapp
 * (código de emparejamiento que tecleas EN el móvil, o QR). `bridge` es opcional
 * en todas las llamadas (default telegram → compat con el form existente).
 *
 * Dos niveles, como el wizard:
 *  (A) instancia/admin, una vez: credencial (solo telegram) + levantar el hub.
 *  (B) per-usuario: login de la cuenta.
 *
 * El `api_hash` nunca vuelve del backend (solo `telegram_app_configured`).
 */

import { api } from './api';

// Espejo del registro de Core (`core/src/services/matrix-hub/registry.ts`). No se
// puede derivar del backend en tiempo de compilación, así que se sincroniza a
// mano — y el criterio P0-1 del playbook exige que ese espejo no derive.
export type BridgeId = 'telegram' | 'whatsapp' | 'meta' | 'gmessages' | 'irc' | 'googlechat' | 'qq';

export interface BridgeBlock {
  configured: boolean;
  registered: boolean;
  running: boolean;
  bot_mxid: string;
  /** Solo telegram (api_id/api_hash). */
  api_credentials?: boolean;
  ready_for_login?: boolean;
}

export interface MatrixHubStatus {
  homeserver: {
    installed: boolean;
    running: boolean;
    healthy: boolean;
    server_name: string;
    user_provisioned: boolean;
  };
  /** Legacy (= bridges.telegram) — lo lee el TelegramMatrixForm. */
  bridge: BridgeBlock;
  telegram_app_configured: boolean;
  /** El wizard deriva su paso de aquí — no de flags locales. */
  ready_for_login: boolean;
  /** Vista por-bridge (wizards nuevos). */
  bridges?: Record<BridgeId, BridgeBlock>;
}

export type LoginState =
  | 'awaiting_phone'
  | 'awaiting_code'
  | 'awaiting_password'
  /** El usuario debe actuar EN SU MÓVIL (pairing code / QR de WhatsApp). */
  | 'awaiting_pair'
  | 'done'
  | 'idle'
  | 'error'
  | 'unknown';

export interface LoginResult {
  state: LoginState;
  /** Texto literal del bridge — se muestra SIEMPRE (aunque no lo reconozcamos). */
  message: string;
  hint: string | null;
  /** Código de emparejamiento (whatsapp) — se pinta GRANDE en el wizard. */
  pairing_code?: string | null;
  /** QR de login como data URI (whatsapp, step `qr`). */
  qr?: string | null;
}

export type LoginStep = 'start' | 'phone' | 'code' | 'password' | 'qr' | 'cookies' | 'input' | 'cancel' | 'status';

export async function getMatrixHubStatus(): Promise<MatrixHubStatus> {
  const res = await api.get<{ data: MatrixHubStatus }>('/sync/matrix/status');
  return res.data;
}

/** (A) Guarda la credencial de instancia (admin). */
export async function saveTelegramApp(apiId: string, apiHash: string): Promise<void> {
  await api.put('/sync/matrix/telegram-app', { api_id: apiId, api_hash: apiHash });
}

/** (A) Levanta Synapse + el bridge (idempotente). Lento la 1ª vez: pull de imágenes. */
export async function startMatrixHub(bridge?: BridgeId): Promise<MatrixHubStatus> {
  const res = await api.post<{ data: MatrixHubStatus }>(
    '/sync/matrix/start',
    bridge ? { bridge } : {},
    { timeout: 600_000 },
  );
  return res.data;
}

/** (B) Avanza el login un paso. El backend habla con el bridge y devuelve su respuesta. */
export async function advanceLogin(step: LoginStep, value?: string, bridge?: BridgeId): Promise<LoginResult> {
  const res = await api.post<{ data: LoginResult }>(
    '/sync/matrix/bridge-login',
    { step, value, ...(bridge ? { bridge } : {}) },
    { timeout: 90_000 },
  );
  return res.data;
}

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

// ─── Errores del contrato de writes de credenciales/modelos ─────────
// Core responde con códigos tipados (2026-07-13):
//   409 PROVIDER_NOT_AUTHENTICATED (details.provider) — falta la key
//   503 GATEWAY_BUSY (details.retry_after_ms) — el write NO aterrizó
//   422 CONFIG_VALIDATION_FAILED — mensaje literal del Gateway
// Este helper convierte cualquiera de ellos en un mensaje legible para
// toasts; lo comparten el wizard, las mutaciones y Provider Status.

import { ApiError } from '@/services/api';

export function isProviderNotAuthenticated(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'PROVIDER_NOT_AUTHENTICATED';
}

/** Provider del 409 PROVIDER_NOT_AUTHENTICATED (si viene en details). */
export function providerFromAuthError(err: unknown): string | null {
  if (!isProviderNotAuthenticated(err)) return null;
  const p = err.details?.provider;
  return typeof p === 'string' && p ? p : null;
}

export function describeCredentialError(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof ApiError) {
    if (err.code === 'GATEWAY_BUSY') {
      const raw = err.details?.retry_after_ms;
      const ms = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
      return ms != null
        ? `Gateway busy — try again in ${Math.max(1, Math.ceil(ms / 1000))}s`
        : 'Gateway busy — try again shortly';
    }
    if (err.code === 'CONFIG_VALIDATION_FAILED') {
      // Mensaje literal del Gateway: es la única pista accionable.
      return err.message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

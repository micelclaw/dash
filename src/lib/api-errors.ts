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

// ─── API error helpers ──────────────────────────────────────────────
//
// `describeError(err, fallback?, overrides?)` turns an opaque thrown
// error into a user-facing string. Replaces ad-hoc per-section parsers
// (DatabaseSection, SecuritySection, HooksSection, RawConfigPage,
// LoggingSection...) that duplicated almost the same logic.
//
// The api client normalises errors into `{ status, code, message }`
// shape, so this helper just inspects those fields. Sections can pass
// `overrides` to refine the wording for codes/statuses that mean
// something specific to their context — e.g. 401 in DatabaseSection
// means "wrong password for credentials reveal", not "session expired".

export interface NormalizedApiError {
  status?: number;
  code?: string;
  message?: string;
}

/** Generic HTTP-status fallbacks. Sections can override via `overrides.status`. */
const DEFAULT_STATUS_MESSAGES: Record<number, string> = {
  401: 'Wrong credentials or session expired',
  403: 'You do not have permission for this action',
  404: 'Not found',
  409: 'Conflict — refresh and try again',
  410: 'Resource is gone',
  413: 'Payload too large',
  422: 'Validation failed',
  429: 'Too many requests — wait and retry',
};

/** Backend error codes we map to friendly text. Sections can override via `overrides.code`. */
const DEFAULT_CODE_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Wrong password',
  INVALID_JSON: 'Invalid JSON',
  INVALID_ROLE: 'Invalid role',
  HASH_MISMATCH: 'Config changed externally — refresh and reapply',
  RATE_LIMIT: 'Rate-limited — wait and retry',
  RAW_CONFIG_WRITE_FAILED: 'Disk write failed — check Gateway permissions',
  CONFIG_PATCH_FAILED: 'Config rejected by the Gateway',
  LAST_ADMIN: 'Cannot demote the last admin',
};

export interface DescribeErrorOptions {
  /** Per-section overrides for HTTP status messages. Keys are status codes (numbers). */
  status?: Record<number, string>;
  /** Per-section overrides for backend error codes. */
  code?: Record<string, string>;
}

/**
 * Convert an unknown thrown error into a user-facing string suitable
 * for a toast or inline label. Resolution order:
 *   1. Backend `code` → overrides → defaults
 *   2. HTTP `status` → overrides → defaults
 *   3. 5xx → "Server error — try again later"
 *   4. `err.message` if any
 *   5. `fallback`
 */
export function describeError(
  err: unknown,
  fallback: string = 'Operation failed',
  overrides?: DescribeErrorOptions,
): string {
  const e = err as NormalizedApiError | undefined;
  if (!e) return fallback;

  if (e.code) {
    const codeMsg = overrides?.code?.[e.code] ?? DEFAULT_CODE_MESSAGES[e.code];
    if (codeMsg) return codeMsg;
  }
  if (typeof e.status === 'number') {
    const statusMsg = overrides?.status?.[e.status] ?? DEFAULT_STATUS_MESSAGES[e.status];
    if (statusMsg) return statusMsg;
    if (e.status >= 500) return 'Server error — try again later';
  }
  return e.message ?? fallback;
}

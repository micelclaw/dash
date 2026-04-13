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

export type UserRole = 'owner' | 'admin' | 'user';
export type Tier = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  tier: Tier;
  /** ISO timestamp of the last password change. Optional for back-compat with old sessions. */
  password_changed_at?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /**
   * Database id of the row in `refresh_tokens`. Sent to the dash by
   * `/auth/login`, `/auth/login-2fa` and `/auth/refresh`. Used by the
   * Active Sessions UI to mark "this device" and to scope
   * `revoke-others` correctly.
   *
   * Optional because old persisted sessions (pre-Account-enhancements)
   * don't have it; the dash falls back gracefully.
   */
  refreshTokenId?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

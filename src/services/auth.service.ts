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
 * Self-service auth helpers used by the AccountSection.
 *
 * Wraps the new endpoints added in F3-F5:
 *   - GET /auth/sessions          (list active sessions)
 *   - DELETE /auth/sessions/:id   (revoke one)
 *   - POST /auth/sessions/revoke-others
 *   - GET /auth/2fa/status
 *   - POST /auth/2fa/setup
 *   - POST /auth/2fa/verify
 *   - POST /auth/2fa/disable
 *   - POST /auth/2fa/regenerate-backup-codes
 *
 * The (admin-only) user management surface lives in users.service.ts;
 * this file only deals with the *current user's own* security state.
 */

import { api } from './api';

// ─── Active Sessions ─────────────────────────────────────────────

export interface ActiveSession {
  id: string;
  device_label: string;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string;
  is_current: boolean;
}

export async function listSessions(currentId?: string): Promise<ActiveSession[]> {
  const res = await api.get<{ data: ActiveSession[] }>(
    '/auth/sessions',
    currentId ? { current_id: currentId } : undefined,
  );
  return res.data;
}

export async function revokeSession(id: string): Promise<void> {
  await api.delete(`/auth/sessions/${id}`);
}

export async function revokeOtherSessions(currentId: string | null): Promise<{ revoked: number }> {
  const res = await api.post<{ data: { revoked: number } }>(
    '/auth/sessions/revoke-others',
    { current_id: currentId ?? '' },
  );
  return res.data;
}

// ─── 2FA (TOTP) ──────────────────────────────────────────────────

export interface TwoFactorStatus {
  enabled: boolean;
  backup_codes_remaining: number;
}

export interface TwoFactorSetupResult {
  secret: string;
  qr_data_url: string;
  otpauth_url: string;
}

export async function get2faStatus(): Promise<TwoFactorStatus> {
  const res = await api.get<{ data: TwoFactorStatus }>('/auth/2fa/status');
  return res.data;
}

export async function setup2fa(): Promise<TwoFactorSetupResult> {
  const res = await api.post<{ data: TwoFactorSetupResult }>('/auth/2fa/setup');
  return res.data;
}

export async function verify2fa(code: string): Promise<{ backup_codes: string[] }> {
  const res = await api.post<{ data: { backup_codes: string[] } }>('/auth/2fa/verify', { code });
  return res.data;
}

export async function disable2fa(currentPassword: string): Promise<void> {
  await api.post('/auth/2fa/disable', { current_password: currentPassword });
}

export async function regenerateBackupCodes(currentPassword: string): Promise<{ backup_codes: string[] }> {
  const res = await api.post<{ data: { backup_codes: string[] } }>(
    '/auth/2fa/regenerate-backup-codes',
    { current_password: currentPassword },
  );
  return res.data;
}

// ─── Password ─────────────────────────────────────────────────────

export async function changePassword(params: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await api.post('/auth/change-password', params);
}

export async function changeEmail(params: {
  current_password: string;
  new_email: string;
}): Promise<{ email: string; display_name: string }> {
  const res = await api.post<{ data: { email: string; display_name: string } }>(
    '/auth/change-email',
    params,
  );
  return res.data;
}

// ─── Profile ──────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  display_name?: string;
  avatar_path?: string | null;
}

export interface MeResponse {
  avatar_path: string | null;
  password_changed_at: string | null;
}

/** Read the current user's profile (extra fields not in the auth store). */
export async function getMe(): Promise<MeResponse> {
  const res = await api.get<{ data: MeResponse }>('/auth/me');
  return res.data;
}

export async function updateProfile(
  body: UpdateProfilePayload,
): Promise<{ display_name: string; avatar_path: string | null }> {
  const res = await api.patch<{ data: { display_name: string; avatar_path: string | null } }>(
    '/auth/me',
    body,
  );
  return res.data;
}

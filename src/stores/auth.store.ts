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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, Tier } from '@/types/auth';
import { api } from '@/services/api';

/**
 * Pending 2FA challenge state. Set by `login()` when the backend
 * returns `needs_2fa: true`. The dash transitions the LoginPage to
 * the second-step form, which calls `login2fa()` with the code.
 *
 * Cleared on successful 2FA verification, on `cancelPending2fa()`,
 * or on `logout()`.
 */
export interface PendingTwoFactor {
  challengeId: string;
  email: string;
}

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  /** Set when /auth/login returned needs_2fa=true; cleared after verification or cancel. */
  pending2fa: PendingTwoFactor | null;
  /** Step 1 of login. Returns {needs2fa:true} when 2FA is enabled, {ok:true} otherwise. */
  login: (email: string, password: string) => Promise<{ needs2fa: true } | { ok: true }>;
  /** Step 2 of login. Uses the stored pending2fa.challengeId. */
  login2fa: (code: string) => Promise<void>;
  /** Cancel a pending 2FA challenge (return to email/password form). */
  cancelPending2fa: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  setAuth: (user: User, tokens: AuthTokens) => void;
  /** Patch the cached user in place (after self-service profile update). */
  setUser: (user: User) => void;
}

// Lock to deduplicate concurrent refresh calls — only one in-flight at a time
let refreshPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      pending2fa: null,

      login: async (email: string, password: string) => {
        const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
          '/auth/login',
          { email, password },
        );
        const d = res.data;

        // 2FA gate: backend asks for a TOTP code before issuing tokens.
        if (d.needs_2fa) {
          set({
            pending2fa: {
              challengeId: d.challenge_id as string,
              email,
            },
          });
          return { needs2fa: true };
        }

        // Normal path: tokens issued immediately.
        const accessToken = d.access_token as string;
        const refreshToken = d.refresh_token as string;
        const refreshTokenId = d.refresh_token_id as string | undefined;
        const user = d.user as User;
        user.tier = (res.tier as Tier) ?? 'free';
        set({
          user,
          tokens: { accessToken, refreshToken, refreshTokenId },
          isAuthenticated: true,
          pending2fa: null,
        });
        return { ok: true };
      },

      login2fa: async (code: string) => {
        const pending = get().pending2fa;
        if (!pending) {
          throw new Error('No pending 2FA challenge');
        }
        const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
          '/auth/login-2fa',
          { challenge_id: pending.challengeId, code },
        );
        const d = res.data;
        const accessToken = d.access_token as string;
        const refreshToken = d.refresh_token as string;
        const refreshTokenId = d.refresh_token_id as string | undefined;
        const user = d.user as User;
        user.tier = (res.tier as Tier) ?? 'free';
        set({
          user,
          tokens: { accessToken, refreshToken, refreshTokenId },
          isAuthenticated: true,
          pending2fa: null,
        });
      },

      cancelPending2fa: () => {
        set({ pending2fa: null });
      },

      logout: () => {
        sessionStorage.setItem('claw-explicit-logout', '1');
        set({ user: null, tokens: null, isAuthenticated: false, pending2fa: null });
      },

      refresh: async () => {
        // Deduplicate: if a refresh is already in flight, wait for it
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
          const { tokens, user } = get();
          if (!tokens?.refreshToken) return;
          try {
            const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
              '/auth/refresh',
              { refresh_token: tokens.refreshToken },
            );
            const d = res.data;
            const updatedUser = user ? { ...user, tier: (res.tier as Tier) ?? user.tier } : user;
            set({
              user: updatedUser,
              tokens: {
                accessToken: d.access_token as string,
                refreshToken: d.refresh_token as string,
                refreshTokenId: d.refresh_token_id as string | undefined,
              },
            });
          } catch {
            get().logout();
          }
        })();

        try {
          await refreshPromise;
        } finally {
          refreshPromise = null;
        }
      },

      setAuth: (user: User, tokens: AuthTokens) => {
        set({ user, tokens, isAuthenticated: true });
      },

      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'claw-auth',
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

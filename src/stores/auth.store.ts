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
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { User, AuthTokens, Tier } from '@/types/auth';
import { api, ApiError } from '@/services/api';
import { logoutSession } from '@/services/auth.service';

/**
 * "Recordar usuario": si está activo (default), la sesión se guarda en
 * localStorage y sobrevive al cierre de la app (hasta 30 días, la vida del
 * refresh token). Si el usuario lo desmarca, se guarda en sessionStorage y se
 * borra al cerrar. El flag lo escribe la LoginPage en `claw-remember` ANTES de
 * autenticar; este storage lo lee para decidir dónde persistir.
 */
export const REMEMBER_KEY = 'claw-remember';
function rememberEnabled(): boolean {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; }
}
const authStorage: StateStorage = {
  getItem: (name) => {
    try { return localStorage.getItem(name) ?? sessionStorage.getItem(name); } catch { return null; }
  },
  setItem: (name, value) => {
    try {
      if (rememberEnabled()) { localStorage.setItem(name, value); sessionStorage.removeItem(name); }
      else { sessionStorage.setItem(name, value); localStorage.removeItem(name); }
    } catch { /* almacenamiento no disponible */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); sessionStorage.removeItem(name); } catch { /* no-op */ }
  },
};

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

export type AuthRefreshResult = { status: 'refreshed' | 'transient' | 'rejected' | 'unavailable' | 'cancelled' };

interface AuthStore {
  sessionGeneration: number;
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  /** Set when /auth/login returned needs_2fa=true; cleared after verification or cancel. */
  pending2fa: PendingTwoFactor | null;
  /** Step 1 of login. Returns {needs2fa:true} when 2FA is enabled, {ok:true} otherwise. */
  login: (email: string, password: string) => Promise<{ needs2fa: true } | { needsEnrollment: true; token: string; expiresAt: string } | { ok: true }>;
  /** Step 2 of login. Uses the stored pending2fa.challengeId. */
  login2fa: (code: string) => Promise<void>;
  /** Cancel a pending 2FA challenge (return to email/password form). */
  cancelPending2fa: () => void;
  logoutState: 'idle' | 'revoking' | 'error';
  logoutError: string | null;
  logoutPending: { refreshToken: string; uncertainRefresh: boolean } | null;
  logout: () => Promise<void>;
  /** Local invalidation after server rejection/revocation; not a remote logout claim. */
  clearSession: () => void;
  refresh: () => Promise<AuthRefreshResult>;
  setAuth: (user: User, tokens: AuthTokens) => void;
  /** Patch the cached user in place (after self-service profile update). */
  setUser: (user: User) => void;
}

// Lock to deduplicate concurrent refresh calls — only one in-flight at a time
type RefreshFlight = { generation: number; promise: Promise<AuthRefreshResult>; resultTokens: AuthTokens | null };
let refreshFlight: RefreshFlight | null = null;
let logoutFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      sessionGeneration: 0,
      user: null,
      tokens: null,
      isAuthenticated: false,
      pending2fa: null,
      logoutState: 'idle', logoutError: null, logoutPending: null,

      login: async (email: string, password: string) => {
        if (get().logoutState !== 'idle') throw new Error('La salida anterior no está confirmada');
        const generation = get().sessionGeneration;
        const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
          '/auth/login',
          { email, password },
        );
        if (get().sessionGeneration !== generation) throw new Error('La sesión cambió durante el inicio');
        const d = res.data;

        // Enrollment is a purpose-limited capability, never authentication state.
        // The caller keeps it in component memory; persist() cannot serialize it.
        if (d.needs_2fa_enrollment === true) {
          if (typeof d.enrollment_token !== 'string' || typeof d.expires_at !== 'string') throw new Error('Respuesta de inscripción no válida');
          return { needsEnrollment: true, token: d.enrollment_token, expiresAt: d.expires_at };
        }

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
          sessionGeneration: get().sessionGeneration + 1,
          user,
          tokens: { accessToken, refreshToken, refreshTokenId },
          isAuthenticated: true,
          pending2fa: null,
        });
        return { ok: true };
      },

      login2fa: async (code: string) => {
        if (get().logoutState !== 'idle') throw new Error('La salida anterior no está confirmada');
        const generation = get().sessionGeneration;
        const pending = get().pending2fa;
        if (!pending) {
          throw new Error('No pending 2FA challenge');
        }
        const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
          '/auth/login-2fa',
          { challenge_id: pending.challengeId, code },
        );
        if (get().sessionGeneration !== generation) throw new Error('La sesión cambió durante el inicio');
        const d = res.data;
        const accessToken = d.access_token as string;
        const refreshToken = d.refresh_token as string;
        const refreshTokenId = d.refresh_token_id as string | undefined;
        const user = d.user as User;
        user.tier = (res.tier as Tier) ?? 'free';
        set({
          sessionGeneration: get().sessionGeneration + 1,
          user,
          tokens: { accessToken, refreshToken, refreshTokenId },
          isAuthenticated: true,
          pending2fa: null,
        });
      },

      cancelPending2fa: () => {
        set({ pending2fa: null });
      },

      clearSession: () => {
        try { sessionStorage.setItem('claw-explicit-logout', '1'); } catch { /* unavailable storage */ }
        set({ sessionGeneration: get().sessionGeneration + 1, user: null, tokens: null,
          isAuthenticated: false, pending2fa: null, logoutState: 'idle', logoutError: null, logoutPending: null });
      },

      logout: async () => {
        if (logoutFlight) return logoutFlight;
        const starting = get(), oldRefresh = refreshFlight?.generation === starting.sessionGeneration ? refreshFlight : null;
        const generation = starting.sessionGeneration + 1;
        const pending = starting.logoutPending ?? { refreshToken: starting.tokens?.refreshToken ?? '', uncertainRefresh: false };
        set({ sessionGeneration: generation, logoutState: 'revoking', logoutError: null, logoutPending: pending });
        logoutFlight = (async () => {
          try {
            if (oldRefresh) {
              const result = await oldRefresh.promise;
              if (oldRefresh.resultTokens) pending.refreshToken = oldRefresh.resultTokens.refreshToken;
              else if (result.status === 'transient') pending.uncertainRefresh = true;
              set({ logoutPending: { ...pending } });
            }
            if (get().sessionGeneration !== generation) throw new Error('La sesión cambió antes de revocarse');
            if (pending.uncertainRefresh) throw new Error('La renovación perdió su respuesta. El cierre remoto no está confirmado; revisa la sesión específica en Sesiones activas.');
            await logoutSession(pending.refreshToken);
            if (get().sessionGeneration === generation) get().clearSession();
          } catch (error) {
            if (get().sessionGeneration === generation) set({ logoutState: 'error', logoutPending: { ...pending },
              logoutError: pending.uncertainRefresh ? (error as Error).message : 'No se pudo confirmar la revocación. Conservamos la sesión para reintentar.' });
            throw error;
          }
        })();
        try { await logoutFlight; } finally { logoutFlight = null; }
      },

      refresh: async () => {
        const { tokens, user, sessionGeneration } = get();
        if (get().logoutState !== 'idle') return { status: 'cancelled' };
        if (refreshFlight?.generation === sessionGeneration) return refreshFlight.promise;
        if (!tokens?.refreshToken) return { status: 'unavailable' };
        const current = () => get().sessionGeneration === sessionGeneration && get().tokens === tokens;
        // A separate receipt is safe even if the API fails synchronously.
        const receipt: { tokens: AuthTokens | null } = { tokens: null };
        const flight: RefreshFlight = {
          generation: sessionGeneration, get resultTokens() { return receipt.tokens; },
          promise: (async (): Promise<AuthRefreshResult> => {
            try {
              const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
                '/auth/refresh', { refresh_token: tokens.refreshToken },
              );
              const d = res.data;
              receipt.tokens = { accessToken: d.access_token as string, refreshToken: d.refresh_token as string, refreshTokenId: d.refresh_token_id as string | undefined };
              if (!current()) return { status: 'cancelled' };
              set({
                user: user ? { ...user, tier: (res.tier as Tier) ?? user.tier } : user,
                tokens: {
                  accessToken: d.access_token as string,
                  refreshToken: d.refresh_token as string,
                  refreshTokenId: d.refresh_token_id as string | undefined,
                },
              });
              return { status: 'refreshed' };
            } catch (err) {
              const status = err instanceof ApiError ? err.status : undefined;
              if (!current()) return { status: status === 401 || status === 403 ? 'rejected' : 'transient' };
              if (status === 401 || status === 403) {
                get().clearSession();
                return { status: 'rejected' };
              }
              // Network/5xx retain the current session. Callers can distinguish
              // this from a successful renewal without comparing JWT bytes.
              return { status: 'transient' };
            }
          })(),
        };
        refreshFlight = flight;
        try { return await flight.promise; }
        finally { if (refreshFlight === flight) refreshFlight = null; }
      },

      setAuth: (user: User, tokens: AuthTokens) => {
        if (get().logoutState !== 'idle') return;
        set({ sessionGeneration: get().sessionGeneration + 1, user, tokens, isAuthenticated: true });
      },

      setUser: (user: User) => {
        if (get().user?.id === user.id) set({ user });
      },
    }),
    {
      name: 'claw-auth',
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        logoutState: state.logoutState === 'revoking' ? 'error' : state.logoutState,
        logoutError: state.logoutState === 'revoking' ? 'Salida interrumpida. Reintenta la revocación.' : state.logoutError,
        logoutPending: state.logoutPending,
      }),
    },
  ),
);

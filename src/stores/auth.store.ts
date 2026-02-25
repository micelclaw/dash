import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, Tier } from '@/types/auth';
import { api } from '@/services/api';

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setAuth: (user: User, tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const res = await api.post<{ data: Record<string, unknown>; tier?: string }>(
          '/auth/login',
          { email, password },
        );
        const d = res.data;
        // API keys are snake_case after transformer (access_token, refresh_token)
        const accessToken = (d.access_token ?? d.accessToken) as string;
        const refreshToken = (d.refresh_token ?? d.refreshToken) as string;
        const user = d.user as User;
        user.tier = (res.tier as Tier) ?? 'free';
        set({ user, tokens: { accessToken, refreshToken }, isAuthenticated: true });
      },

      logout: () => {
        sessionStorage.setItem('claw-explicit-logout', '1');
        set({ user: null, tokens: null, isAuthenticated: false });
      },

      refresh: async () => {
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
              accessToken: (d.access_token ?? d.accessToken) as string,
              refreshToken: (d.refresh_token ?? d.refreshToken) as string,
            },
          });
        } catch {
          get().logout();
        }
      },

      setAuth: (user: User, tokens: AuthTokens) => {
        set({ user, tokens, isAuthenticated: true });
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

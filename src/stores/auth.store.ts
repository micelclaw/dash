import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens } from '@/types/auth';
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
        const res = await api.post<{ data: { user: User; accessToken: string; refreshToken: string } }>(
          '/auth/login',
          { email, password },
        );
        const { user, accessToken, refreshToken } = res.data;
        set({ user, tokens: { accessToken, refreshToken }, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, tokens: null, isAuthenticated: false });
      },

      refresh: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) return;
        try {
          const res = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
            '/auth/refresh',
            { refresh_token: tokens.refreshToken },
          );
          set({
            tokens: {
              accessToken: res.data.accessToken,
              refreshToken: res.data.refreshToken,
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

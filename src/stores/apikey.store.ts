import { create } from 'zustand';
import { api } from '@/services/api';

interface ApiKeyState {
  providers: Record<string, { configured: boolean; last_4: string; valid?: boolean }>;
  testing: string | null;

  loadFromSettings: (keys: Record<string, { configured: boolean; last_4: string }>) => void;
  configureKey: (provider: string, apiKey: string) => Promise<void>;
  deleteKey: (provider: string) => Promise<void>;
  testConnection: (provider: string) => Promise<{ valid: boolean }>;
}

export const useApiKeyStore = create<ApiKeyState>()((set, get) => ({
  providers: {},
  testing: null,

  loadFromSettings: (keys: Record<string, { configured: boolean; last_4: string }>) => {
    set({ providers: { ...keys } });
  },

  configureKey: async (provider: string, apiKey: string) => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const last4 = apiKey.slice(-4);
      set({
        providers: {
          ...get().providers,
          [provider]: { configured: true, last_4: last4, valid: true },
        },
      });
      return;
    }
    const res = await api.put<{ data: { configured: boolean; last_4: string; valid: boolean } }>(
      `/settings/ai/api-keys/${provider}`,
      { api_key: apiKey },
    );
    set({
      providers: {
        ...get().providers,
        [provider]: res.data,
      },
    });
  },

  deleteKey: async (provider: string) => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      const { [provider]: _, ...rest } = get().providers;
      set({ providers: { ...rest, [provider]: { configured: false, last_4: '', valid: undefined } } });
      return;
    }
    await api.delete(`/settings/ai/api-keys/${provider}`);
    set({
      providers: {
        ...get().providers,
        [provider]: { configured: false, last_4: '', valid: undefined },
      },
    });
  },

  testConnection: async (provider: string) => {
    set({ testing: provider });
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        await new Promise((r) => setTimeout(r, 800));
        const result = { valid: true };
        set({
          testing: null,
          providers: {
            ...get().providers,
            [provider]: { ...get().providers[provider], valid: result.valid },
          },
        });
        return result;
      }
      const res = await api.post<{ data: { valid: boolean } }>(`/settings/ai/api-keys/${provider}/test`);
      set({
        testing: null,
        providers: {
          ...get().providers,
          [provider]: { ...get().providers[provider], valid: res.data.valid },
        },
      });
      return res.data;
    } catch {
      set({ testing: null });
      return { valid: false };
    }
  },
}));

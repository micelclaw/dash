import { create } from 'zustand';
import { api } from '@/services/api';
import type { SecurityConfig, Approval } from '@/types/settings';

const DEFAULT_CONFIG: SecurityConfig = {
  approval_enabled: true,
  approval_levels: {
    destructive: 'confirm',
    external: 'confirm',
    financial: 'pin',
    sensitive: 'confirm',
  },
  pin_configured: false,
  session_timeout_minutes: 30,
  auto_approve_trusted_skills: true,
};

interface SecurityState {
  config: SecurityConfig | null;
  approvals: Approval[];
  loading: boolean;

  fetchConfig: () => Promise<void>;
  updateConfig: (data: Partial<SecurityConfig>) => Promise<void>;
  fetchApprovals: (status?: string) => Promise<void>;
  resolveApproval: (id: string, decision: 'approved' | 'denied', pin?: string) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<{ verified: boolean; session_token?: string }>;
}

export const useSecurityStore = create<SecurityState>()((set, get) => ({
  config: null,
  approvals: [],
  loading: false,

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        set({ config: DEFAULT_CONFIG, loading: false });
        return;
      }
      const res = await api.get<{ data: SecurityConfig }>('/settings/security');
      set({ config: res.data, loading: false });
    } catch {
      set({ config: DEFAULT_CONFIG, loading: false });
    }
  },

  updateConfig: async (data: Partial<SecurityConfig>) => {
    const { config } = get();
    if (!config) return;
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        set({ config: { ...config, ...data } });
        return;
      }
      const res = await api.patch<{ data: SecurityConfig }>('/settings/security', data);
      set({ config: res.data });
    } catch {
      throw new Error('Failed to update security config');
    }
  },

  fetchApprovals: async (status?: string) => {
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        set({ approvals: [] });
        return;
      }
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const res = await api.get<{ data: Approval[] }>('/approvals', params);
      set({ approvals: res.data });
    } catch {
      set({ approvals: [] });
    }
  },

  resolveApproval: async (id: string, decision: 'approved' | 'denied', pin?: string) => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      set({ approvals: get().approvals.filter((a) => a.id !== id) });
      return;
    }
    await api.post(`/approvals/${id}/resolve`, { decision, pin });
    set({ approvals: get().approvals.filter((a) => a.id !== id) });
  },

  setupPin: async (pin: string) => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      set({ config: { ...get().config!, pin_configured: true } });
      return;
    }
    await api.post('/auth/pin/setup', { pin });
    set({ config: { ...get().config!, pin_configured: true } });
  },

  verifyPin: async (pin: string) => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      return { verified: true, session_token: 'mock-session' };
    }
    const res = await api.post<{ data: { verified: boolean; session_token?: string } }>('/auth/pin/verify', { pin });
    return res.data;
  },
}));

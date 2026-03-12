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
import { api } from '@/services/api';
import type { SecurityConfig, ApprovalRequest } from '@/types/settings';

interface SecurityState {
  config: SecurityConfig | null;
  approvals: ApprovalRequest[];
  pendingCount: number;
  loading: boolean;

  fetchConfig: () => Promise<void>;
  updateConfig: (data: Partial<SecurityConfig>) => Promise<void>;
  fetchApprovals: (status?: string) => Promise<void>;
  fetchPendingCount: () => Promise<void>;
  approveApproval: (id: string, credential?: string) => Promise<void>;
  rejectApproval: (id: string, reason?: string) => Promise<void>;
  setupPin: (pin: string, currentPassword: string) => Promise<void>;
  removePin: (currentPassword: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<{ verified: boolean }>;
  fetchPinStatus: () => Promise<boolean>;

  // WS event handlers
  onApprovalNew: (data: ApprovalRequest) => void;
  onApprovalResolved: (data: { id: string; status: string }) => void;
}

export const useSecurityStore = create<SecurityState>()((set, get) => ({
  config: null,
  approvals: [],
  pendingCount: 0,
  loading: false,

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ data: SecurityConfig }>('/settings/security');
      set({ config: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateConfig: async (data: Partial<SecurityConfig>) => {
    try {
      const res = await api.patch<{ data: SecurityConfig }>('/settings/security', data);
      set({ config: res.data });
    } catch {
      throw new Error('Failed to update security config');
    }
  },

  fetchApprovals: async (status?: string) => {
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const res = await api.get<{ data: ApprovalRequest[] }>('/approvals', params);
      set({ approvals: res.data });
    } catch {
      set({ approvals: [] });
    }
  },

  fetchPendingCount: async () => {
    try {
      const res = await api.get<{ data: { pending: number } }>('/approvals/count');
      set({ pendingCount: res.data.pending });
    } catch {
      // Silent
    }
  },

  approveApproval: async (id: string, credential?: string) => {
    const body: Record<string, unknown> = {};
    if (credential) body.credential = credential;
    await api.post(`/approvals/${id}/approve`, body);
    set({
      approvals: get().approvals.filter((a) => a.id !== id),
      pendingCount: Math.max(0, get().pendingCount - 1),
    });
  },

  rejectApproval: async (id: string, reason?: string) => {
    const body: Record<string, unknown> = {};
    if (reason) body.reason = reason;
    await api.post(`/approvals/${id}/reject`, body);
    set({
      approvals: get().approvals.filter((a) => a.id !== id),
      pendingCount: Math.max(0, get().pendingCount - 1),
    });
  },

  setupPin: async (pin: string, currentPassword: string) => {
    await api.post('/auth/pin', { pin, current_password: currentPassword });
    const config = get().config;
    if (config) {
      set({ config: { ...config, pin_configured: true } });
    }
  },

  removePin: async (currentPassword: string) => {
    await api.delete('/auth/pin', { current_password: currentPassword });
    const config = get().config;
    if (config) {
      set({ config: { ...config, pin_configured: false } });
    }
  },

  verifyPin: async (pin: string) => {
    const res = await api.post<{ data: { verified: boolean } }>('/auth/pin/verify', { pin });
    return res.data;
  },

  fetchPinStatus: async () => {
    try {
      const res = await api.get<{ data: { configured: boolean } }>('/auth/pin/status');
      return res.data.configured;
    } catch {
      return false;
    }
  },

  // WebSocket event handlers
  onApprovalNew: (data: ApprovalRequest) => {
    set({
      approvals: [data, ...get().approvals],
      pendingCount: get().pendingCount + 1,
    });
  },

  onApprovalResolved: (data: { id: string; status: string }) => {
    set({
      approvals: get().approvals.map((a) =>
        a.id === data.id ? { ...a, status: data.status as ApprovalRequest['status'] } : a,
      ),
      pendingCount: Math.max(0, get().pendingCount - 1),
    });
  },
}));

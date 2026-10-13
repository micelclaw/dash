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
import {
  listApprovalHistory,
  listApprovals,
  resolveApproval as resolveApprovalRequest,
  type ApprovalDecision,
} from '@/services/approvals.service';
import type { SecurityConfig, ApprovalRequest } from '@/types/settings';

interface SecurityState {
  config: SecurityConfig | null;
  configError: string | null;
  approvals: ApprovalRequest[];
  approvalHistory: ApprovalRequest[];
  pendingCount: number;
  loading: boolean;
  approvalsLoading: boolean;
  approvalsError: string | null;
  approvalTotal: number;
  historyTotal: number;

  fetchConfig: () => Promise<void>;
  updateConfig: (data: Partial<SecurityConfig>) => Promise<void>;
  fetchApprovals: (status?: string, limit?: number, offset?: number) => Promise<void>;
  fetchApprovalHistory: (limit?: number, offset?: number) => Promise<void>;
  fetchPendingCount: () => Promise<void>;
  resolveApproval: (id: string, decision: ApprovalDecision, credential?: string, reason?: string) => Promise<ApprovalRequest>;
  approveApproval: (id: string, credential?: string, decision?: Exclude<ApprovalDecision, 'deny'>) => Promise<ApprovalRequest>;
  rejectApproval: (id: string, reason?: string) => Promise<ApprovalRequest>;
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
  configError: null,
  approvals: [],
  approvalHistory: [],
  pendingCount: 0,
  loading: false,
  approvalsLoading: false,
  approvalsError: null,
  approvalTotal: 0,
  historyTotal: 0,

  fetchConfig: async () => {
    set({ loading: true, configError: null });
    try {
      const res = await api.get<{ data: SecurityConfig }>('/settings/security');
      set({ config: res.data, configError: null, loading: false });
    } catch (err) {
      set({
        configError: err instanceof Error ? err.message : 'Failed to load security settings',
        loading: false,
      });
    }
  },

  updateConfig: async (data: Partial<SecurityConfig>) => {
    try {
      const res = await api.patch<{ data: SecurityConfig }>('/settings/security', data);
      set({ config: res.data, configError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update security config';
      set({ configError: message });
      throw err instanceof Error ? err : new Error(message);
    }
  },

  fetchApprovals: async (status = 'pending', limit = 50, offset = 0) => {
    set({ approvalsLoading: true, approvalsError: null });
    try {
      const res = await listApprovals({ status, limit, offset });
      set({
        approvals: res.data ?? [],
        approvalTotal: res.meta?.total ?? res.data?.length ?? 0,
        approvalsLoading: false,
      });
    } catch (err) {
      set({
        approvalsError: err instanceof Error ? err.message : 'Failed to load approvals',
        approvalsLoading: false,
      });
    }
  },

  fetchApprovalHistory: async (limit = 50, offset = 0) => {
    set({ approvalsLoading: true, approvalsError: null });
    try {
      const res = await listApprovalHistory({ limit, offset });
      set({
        approvalHistory: res.data ?? [],
        historyTotal: res.meta?.total ?? res.data?.length ?? 0,
        approvalsLoading: false,
      });
    } catch (err) {
      set({
        approvalsError: err instanceof Error ? err.message : 'Failed to load approval history',
        approvalsLoading: false,
      });
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

  resolveApproval: async (id, decision, credential, reason) => {
    const resolved = await resolveApprovalRequest(id, {
      decision,
      ...(credential ? { credential } : {}),
      ...(reason ? { reason } : {}),
    });
    set({
      approvals: get().approvals.filter((a) => a.id !== id),
      pendingCount: Math.max(0, get().pendingCount - 1),
    });
    return resolved;
  },

  approveApproval: async (id, credential, decision = 'allow_once') => {
    return get().resolveApproval(id, decision, credential);
  },

  rejectApproval: async (id: string, reason?: string) => {
    return get().resolveApproval(id, 'deny', undefined, reason);
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

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

// ─── Types ─────────────────────────────────────────────────

export interface FlowStep {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  inputRef?: string;
  condition?: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  is_template: boolean;
  template_source: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: FlowStep[];
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  run_count: number;
  success_count: number;
  error_count: number;
  version: number;
  timeout_ms: number;
  retry_policy: string;
  event_batch_mode: string;
  approval_timeout_minutes: number;
  notification_config: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  status: string;
  trigger_source: string;
  steps_completed: number;
  steps_total: number;
  current_step_id: string | null;
  resume_token: string | null;
  approval_prompt: string | null;
  approval_preview: unknown;
  output: unknown;
  step_results: Array<{ step_id: string; status: string; output_summary?: string; duration_ms?: number; tokens_used?: number }>;
  error: string | null;
  tokens_used: number;
  cost_usd_estimate: string;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface StepTypeDefinition {
  id: string;
  label: string;
  category: string;
  icon: string;
  description: string;
  outputType: string;
  inputType?: string;
  sideEffect: string;
  requiresService?: string;
  params: Array<{
    id: string;
    label: string;
    type: string;
    options?: Array<{ value: string; label: string }>;
    source?: string;
    default?: unknown;
    required?: boolean;
    placeholder?: string;
  }>;
}

export interface FlowStats {
  total_runs: number;
  success_runs: number;
  error_runs: number;
  avg_duration_ms: number | null;
  total_tokens: number;
  total_cost: number;
}

type ViewMode = 'grid' | 'list' | 'banner';

// ─── Store ─────────────────────────────────────────────────

interface FlowsState {
  flows: Flow[];
  templates: Flow[];
  stepTypes: StepTypeDefinition[];
  pendingRuns: FlowRun[];
  loading: boolean;
  viewMode: ViewMode;

  // Actions
  fetchFlows: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchStepTypes: () => Promise<void>;
  fetchPendingRuns: () => Promise<void>;
  createFlow: (data: Record<string, unknown>) => Promise<Flow>;
  updateFlow: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteFlow: (id: string) => Promise<void>;
  toggleFlow: (id: string) => Promise<void>;
  runFlow: (id: string, params?: Record<string, unknown>) => Promise<{ runId: string }>;
  approveRun: (flowId: string, runId: string) => Promise<void>;
  rejectRun: (flowId: string, runId: string, reason?: string) => Promise<void>;
  undoFlow: (id: string) => Promise<void>;
  saveAsTemplate: (id: string, wizard?: unknown) => Promise<void>;
  fetchRuns: (flowId: string, limit?: number) => Promise<FlowRun[]>;
  fetchStats: (flowId: string) => Promise<FlowStats>;
  setViewMode: (mode: ViewMode) => void;

  // WS handlers
  onWorkflowStarted: (data: Record<string, unknown>) => void;
  onWorkflowCompleted: (data: Record<string, unknown>) => void;
  onWorkflowFailed: (data: Record<string, unknown>) => void;
  onWorkflowNeedsApproval: (data: Record<string, unknown>) => void;
}

interface ApiList<T> { data: T[] }
interface ApiItem<T> { data: T }

export const useFlowsStore = create<FlowsState>()((set, get) => ({
  flows: [],
  templates: [],
  stepTypes: [],
  pendingRuns: [],
  loading: false,
  viewMode: (localStorage.getItem('flows-view-mode') as ViewMode) || 'grid',

  fetchFlows: async () => {
    set({ loading: true });
    try {
      const res = await api.get<ApiList<Flow>>('/flows');
      set({ flows: res?.data ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  fetchTemplates: async () => {
    const res = await api.get<ApiList<Flow>>('/flows/templates');
    set({ templates: res?.data ?? [] });
  },

  fetchStepTypes: async () => {
    const res = await api.get<ApiList<StepTypeDefinition>>('/flows/step-types');
    set({ stepTypes: res?.data ?? [] });
  },

  fetchPendingRuns: async () => {
    const res = await api.get<ApiList<FlowRun>>('/flows/pending');
    set({ pendingRuns: res?.data ?? [] });
  },

  createFlow: async (data) => {
    const res = await api.post<ApiItem<Flow>>('/flows', data);
    set((s) => ({ flows: [res.data, ...s.flows] }));
    return res.data;
  },

  updateFlow: async (id, data) => {
    const res = await api.patch<ApiItem<Flow>>(`/flows/${id}`, data);
    set((s) => ({ flows: s.flows.map((f) => (f.id === id ? res.data : f)) }));
  },

  deleteFlow: async (id) => {
    await api.delete(`/flows/${id}`);
    set((s) => ({ flows: s.flows.filter((f) => f.id !== id) }));
  },

  toggleFlow: async (id) => {
    const res = await api.patch<ApiItem<Flow>>(`/flows/${id}/toggle`);
    set((s) => ({ flows: s.flows.map((f) => (f.id === id ? res.data : f)) }));
  },

  runFlow: async (id, params) => {
    const res = await api.post<ApiItem<{ runId: string }>>(`/flows/${id}/run`, params ? { params } : undefined);
    return res.data;
  },

  approveRun: async (flowId, runId) => {
    await api.post(`/flows/${flowId}/runs/${runId}/approve`);
    set((s) => ({ pendingRuns: s.pendingRuns.filter((r) => r.id !== runId) }));
  },

  rejectRun: async (flowId, runId, reason) => {
    await api.post(`/flows/${flowId}/runs/${runId}/reject`, reason ? { reason } : undefined);
    set((s) => ({ pendingRuns: s.pendingRuns.filter((r) => r.id !== runId) }));
  },

  undoFlow: async (id) => {
    const res = await api.post<ApiItem<Flow>>(`/flows/${id}/undo`);
    set((s) => ({ flows: s.flows.map((f) => (f.id === id ? res.data : f)) }));
  },

  saveAsTemplate: async (id, wizard) => {
    await api.post(`/flows/${id}/save-template`, wizard ? { wizard } : undefined);
    get().fetchTemplates();
  },

  fetchRuns: async (flowId, limit = 20) => {
    const res = await api.get<ApiList<FlowRun>>(`/flows/${flowId}/runs?limit=${limit}`);
    return res.data;
  },

  fetchStats: async (flowId) => {
    const res = await api.get<ApiItem<FlowStats>>(`/flows/${flowId}/stats`);
    return res.data;
  },

  setViewMode: (mode) => {
    localStorage.setItem('flows-view-mode', mode);
    set({ viewMode: mode });
  },

  // WS event handlers
  onWorkflowStarted: (_data) => {
    get().fetchFlows();
  },

  onWorkflowCompleted: (_data) => {
    get().fetchFlows();
    get().fetchPendingRuns();
  },

  onWorkflowFailed: (_data) => {
    get().fetchFlows();
  },

  onWorkflowNeedsApproval: (_data) => {
    get().fetchPendingRuns();
  },
}));

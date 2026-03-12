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

// ─── Types ──────────────────────────────────────────────

export interface ClawProcess {
  id: string;          // e.g. "docker:nginx"
  name: string;
  status: 'running' | 'stopped' | 'error';
  has_logs: boolean;
  restartable: boolean;
  stoppable: boolean;
  uptime?: number;     // ms
  memory_mb?: number;
  cpu_percent?: number;
}

export interface ProcessStats {
  total: number;
  running: number;
  stopped: number;
  cpu_total: number;
  memory_total_mb: number;
}

export interface LogEntry {
  timestamp: string;
  line: string;
}

export interface OllamaLoadedModel {
  name: string;
  size_bytes: number;
  size_vram_bytes: number;
  parameter_size: string;
  expires_at: string;
}

export interface GpuStats {
  gpu_percent: number;
  vram_used_mb: number;
  vram_total_mb: number;
}

export interface OllamaStatus {
  models: OllamaLoadedModel[];
  gpu: GpuStats | null;
}

// Raw shapes from backend (field names differ from frontend)
interface RawProcess {
  id: string;
  name: string;
  type: string;
  status: string;
  cpu_percent: number | null;
  memory_bytes: number | null;
  uptime_seconds: number | null;
  has_logs: boolean;
  restartable: boolean;
  stoppable: boolean;
}

interface RawStats {
  total: number;
  running: number;
  failed?: number;
  cpu_total: number | null;
  memory_total: number | null;
}

// ─── History ────────────────────────────────────────────

const HISTORY_MAX = 30; // 30 × 10s = 5 minutes

export interface MetricHistory {
  cpu: number[];
  memory: number[];
  gpu: number[];
  vram: number[];
}

function pushMetric(arr: number[], val: number): number[] {
  const next = [...arr, val];
  return next.length > HISTORY_MAX ? next.slice(next.length - HISTORY_MAX) : next;
}

// ─── Store ──────────────────────────────────────────────

type SortKey = 'cpu' | 'mem' | 'name' | 'pid' | 'status';

interface ProcessesState {
  processes: ClawProcess[];
  stats: ProcessStats | null;
  loading: boolean;
  error: string | null;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  filter: string;
  selectedId: string | null;
  logs: string[];
  logsLoading: boolean;
  ollamaStatus: OllamaStatus;
  expandedProcessId: string | null;
  history: MetricHistory;

  fetchProcesses: () => Promise<void>;
  restartProcess: (id: string) => Promise<void>;
  stopProcess: (id: string) => Promise<void>;
  startProcess: (id: string) => Promise<void>;
  fetchLogs: (id: string, tail?: number) => Promise<void>;
  setSort: (by: SortKey) => void;
  setFilter: (f: string) => void;
  selectProcess: (id: string | null) => void;
  fetchOllamaStatus: () => Promise<void>;
  unloadOllamaModel: (model: string) => Promise<void>;
  toggleExpandProcess: (id: string) => void;
}

export const useProcessesStore = create<ProcessesState>()((set, get) => ({
  processes: [],
  stats: null,
  loading: false,
  error: null,
  sortBy: 'cpu',
  sortDir: 'desc',
  filter: '',
  selectedId: null,
  logs: [],
  logsLoading: false,
  ollamaStatus: { models: [], gpu: null },
  expandedProcessId: null,
  history: { cpu: [], memory: [], gpu: [], vram: [] },

  fetchProcesses: async () => {
    set({ loading: true, error: null });
    try {
      const [procRes, statsRes] = await Promise.all([
        api.get<{ data: RawProcess[] }>('/hal/processes'),
        api.get<{ data: RawStats }>('/hal/processes/stats'),
      ]);
      // Transform backend field names to frontend shape
      const processes: ClawProcess[] = procRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        status: (p.status === 'failed' ? 'error' : p.status === 'idle' ? 'running' : p.status) as ClawProcess['status'],
        has_logs: p.has_logs,
        restartable: p.restartable ?? false,
        stoppable: p.stoppable ?? false,
        uptime: p.uptime_seconds != null ? p.uptime_seconds * 1000 : undefined,
        memory_mb: p.memory_bytes != null ? p.memory_bytes / (1024 * 1024) : undefined,
        cpu_percent: p.cpu_percent ?? undefined,
      }));
      const raw = statsRes.data;
      const stats: ProcessStats = {
        total: raw.total,
        running: raw.running,
        stopped: raw.failed ?? 0,
        cpu_total: raw.cpu_total ?? 0,
        memory_total_mb: (raw.memory_total ?? 0) / (1024 * 1024),
      };
      const h = get().history;
      set({
        processes, stats, loading: false,
        history: {
          ...h,
          cpu: pushMetric(h.cpu, stats.cpu_total),
          memory: pushMetric(h.memory, stats.memory_total_mb),
        },
      });
      // Always refresh ollama status (GPU + loaded models) in background
      get().fetchOllamaStatus();
    } catch {
      set({ error: 'Failed to fetch processes', loading: false });
    }
  },

  fetchOllamaStatus: async () => {
    try {
      const res = await api.get<{ data: OllamaStatus }>('/hal/processes/ollama/status');
      const h = get().history;
      set({
        ollamaStatus: res.data,
        history: {
          ...h,
          gpu: pushMetric(h.gpu, res.data.gpu?.gpu_percent ?? 0),
          vram: pushMetric(h.vram, res.data.gpu?.vram_used_mb ?? 0),
        },
      });
    } catch {
      // Non-fatal — Ollama may not be running
    }
  },

  unloadOllamaModel: async (model: string) => {
    await api.post('/hal/processes/ollama/unload', { model });
    await get().fetchOllamaStatus();
  },

  toggleExpandProcess: (id: string) => {
    const { expandedProcessId } = get();
    set({ expandedProcessId: expandedProcessId === id ? null : id });
  },

  restartProcess: async (id: string) => {
    try {
      await api.post(`/hal/processes/${encodeURIComponent(id)}/restart`);
      get().fetchProcesses();
    } catch {
      throw new Error('Failed to restart process');
    }
  },

  stopProcess: async (id: string) => {
    try {
      await api.post(`/hal/processes/${encodeURIComponent(id)}/stop`);
      get().fetchProcesses();
    } catch {
      throw new Error('Failed to stop process');
    }
  },

  startProcess: async (id: string) => {
    try {
      await api.post(`/hal/processes/${encodeURIComponent(id)}/start`);
      get().fetchProcesses();
    } catch {
      throw new Error('Failed to start process');
    }
  },

  fetchLogs: async (id: string, tail = 200) => {
    set({ logsLoading: true });
    try {
      const res = await api.get<{ data: { lines: string[] } }>(`/hal/processes/${encodeURIComponent(id)}/logs?tail=${tail}`);
      set({ logs: res.data.lines, logsLoading: false });
    } catch {
      set({ logs: ['Failed to fetch logs'], logsLoading: false });
    }
  },

  setSort: (by: SortKey) => {
    const { sortBy, sortDir } = get();
    if (sortBy === by) {
      set({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy: by, sortDir: 'desc' });
    }
  },

  setFilter: (filter: string) => set({ filter }),

  selectProcess: (id: string | null) => {
    set({ selectedId: id, logs: [] });
    if (id) get().fetchLogs(id);
  },
}));

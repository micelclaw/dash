import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────

export interface ClawProcess {
  id: string;          // e.g. "docker:nginx"
  name: string;
  status: 'running' | 'stopped' | 'error';
  has_logs: boolean;
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

  fetchProcesses: () => Promise<void>;
  restartProcess: (id: string) => Promise<void>;
  stopProcess: (id: string) => Promise<void>;
  startProcess: (id: string) => Promise<void>;
  fetchLogs: (id: string, tail?: number) => Promise<void>;
  setSort: (by: SortKey) => void;
  setFilter: (f: string) => void;
  selectProcess: (id: string | null) => void;
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

  fetchProcesses: async () => {
    set({ loading: true, error: null });
    try {
      const [procRes, statsRes] = await Promise.all([
        api.get<{ data: ClawProcess[] }>('/hal/processes'),
        api.get<{ data: ProcessStats }>('/hal/processes/stats'),
      ]);
      set({ processes: procRes.data, stats: statsRes.data, loading: false });
    } catch {
      set({ error: 'Failed to fetch processes', loading: false });
    }
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

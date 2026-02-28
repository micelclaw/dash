import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────

interface TimelinePoint {
  period: string;
  tokens: number;
  agent: number;
  core: number;
}

interface TokenSummary {
  total_tokens: number;
  by_source: { agent: number; core: number };
  by_model: Record<string, number>;
  timeline: TimelinePoint[];
  estimated_cost_usd: number;
}

interface AppBreakdown {
  app_name: string;
  total_tokens: number;
  cost_usd: number;
  call_count: number;
}

interface ModelBreakdown {
  model: string;
  total_tokens: number;
  cost_usd: number;
  call_count: number;
  is_local: boolean;
}

interface SourceBreakdown {
  agent: { total_tokens: number; cost_usd: number; call_count: number };
  core: { total_tokens: number; cost_usd: number; call_count: number };
}

interface MetricsState {
  summary: TokenSummary | null;
  byApp: AppBreakdown[];
  byModel: ModelBreakdown[];
  bySource: SourceBreakdown | null;
  period: 'hour' | 'day' | 'week' | 'month';
  loading: boolean;

  setPeriod: (period: 'hour' | 'day' | 'week' | 'month') => void;
  fetchAll: () => Promise<void>;
}

// ─── Mock data ──────────────────────────────────────────

const MOCK_SUMMARY: TokenSummary = {
  total_tokens: 45230,
  by_source: { agent: 38500, core: 6730 },
  by_model: { 'claude-sonnet-4-5': 35000, 'nomic-embed-text': 6730, 'claude-haiku-3-5': 3500 },
  timeline: [
    { period: '2026-02-18T00:00:00Z', tokens: 6200, agent: 5100, core: 1100 },
    { period: '2026-02-19T00:00:00Z', tokens: 8100, agent: 6900, core: 1200 },
    { period: '2026-02-20T00:00:00Z', tokens: 5400, agent: 4500, core: 900 },
    { period: '2026-02-21T00:00:00Z', tokens: 9800, agent: 8200, core: 1600 },
    { period: '2026-02-22T00:00:00Z', tokens: 7300, agent: 6100, core: 1200 },
    { period: '2026-02-23T00:00:00Z', tokens: 4200, agent: 3800, core: 400 },
    { period: '2026-02-24T00:00:00Z', tokens: 4230, agent: 3900, core: 330 },
  ],
  estimated_cost_usd: 0.42,
};

const MOCK_BY_APP: AppBreakdown[] = [
  { app_name: 'claw-mail', total_tokens: 45000, cost_usd: 0.98, call_count: 23 },
  { app_name: 'embeddings', total_tokens: 20230, cost_usd: 0, call_count: 150 },
  { app_name: 'claw-search', total_tokens: 12000, cost_usd: 0.15, call_count: 8 },
  { app_name: 'photo-index', total_tokens: 7000, cost_usd: 0, call_count: 12 },
];

const MOCK_BY_MODEL: ModelBreakdown[] = [
  { model: 'claude-sonnet-4-5', total_tokens: 60000, cost_usd: 1.20, call_count: 30, is_local: false },
  { model: 'nomic-embed-text', total_tokens: 27230, cost_usd: 0, call_count: 200, is_local: true },
  { model: 'claude-haiku-3-5', total_tokens: 3500, cost_usd: 0.08, call_count: 5, is_local: false },
];

const MOCK_BY_SOURCE: SourceBreakdown = {
  agent: { total_tokens: 98200, cost_usd: 2.10, call_count: 45 },
  core: { total_tokens: 27230, cost_usd: 0.35, call_count: 300 },
};

// ─── Store ──────────────────────────────────────────────

export const useMetricsStore = create<MetricsState>()((set, get) => ({
  summary: null,
  byApp: [],
  byModel: [],
  bySource: null,
  period: 'day',
  loading: false,

  setPeriod: (period) => {
    set({ period });
    get().fetchAll();
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      if (import.meta.env.VITE_MOCK_API === 'true') {
        await new Promise((r) => setTimeout(r, 400));
        set({ summary: MOCK_SUMMARY, byApp: MOCK_BY_APP, byModel: MOCK_BY_MODEL, bySource: MOCK_BY_SOURCE, loading: false });
        return;
      }

      const period = get().period;
      const [summaryRes, byAppRes, byModelRes, bySourceRes] = await Promise.all([
        api.get<TokenSummary>(`/metrics/tokens?period=${period}`),
        api.get<AppBreakdown[]>('/metrics/tokens/by-app'),
        api.get<ModelBreakdown[]>('/metrics/tokens/by-model'),
        api.get<SourceBreakdown>('/metrics/tokens/by-source'),
      ]);

      // Unwrap API envelope: { data: <payload>, tier } → <payload>
      const unwrap = (res: any) => res?.data ?? res;

      set({
        summary: unwrap(summaryRes),
        byApp: unwrap(byAppRes) ?? [],
        byModel: unwrap(byModelRes) ?? [],
        bySource: unwrap(bySourceRes),
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));

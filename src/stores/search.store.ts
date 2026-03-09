import { create } from 'zustand';
import { api } from '@/services/api';
import type { SearchResult, SearchWeights } from '@/types/search';
import { DEFAULT_SEARCH_WEIGHTS } from '@/types/search';

type SortBy = 'relevance' | 'fulltext' | 'heat' | 'semantic' | 'graph' | 'recent';

let _weightsDebounce: ReturnType<typeof setTimeout> | null = null;

interface SearchState {
  query: string;
  domains: string[];
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  total: number;
  searchType: string | null;
  queryTimeMs: number | null;

  // Advanced
  weights: SearchWeights;
  sortBy: SortBy;
  selectedResult: SearchResult | null;

  // Actions
  setQuery: (q: string) => void;
  setDomains: (domains: string[]) => void;
  /** Quick search — RRF only, used by Ctrl+K */
  search: () => Promise<void>;
  /** Advanced search — weighted fusion, used by Search module */
  searchAdvanced: () => Promise<void>;
  setWeights: (w: Partial<SearchWeights>) => void;
  resetWeights: () => void;
  setSortBy: (s: SortBy) => void;
  setSelectedResult: (r: SearchResult | null) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  query: '',
  domains: [],
  results: [],
  loading: false,
  error: null,
  total: 0,
  searchType: null,
  queryTimeMs: null,
  weights: { ...DEFAULT_SEARCH_WEIGHTS },
  sortBy: 'relevance',
  selectedResult: null,

  setQuery: (q) => set({ query: q }),
  setDomains: (domains) => set({ domains }),

  search: async () => {
    const { query, domains } = get();
    if (!query.trim()) return;
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ q: query, limit: '20' });
      if (domains.length > 0) params.set('domains', domains.join(','));
      const res = await api.get<{ data: SearchResult[]; meta: Record<string, unknown> }>(
        `/search?${params}`,
      );
      set({
        results: res.data ?? [],
        total: (res as any).meta?.total ?? 0,
        searchType: (res as any).meta?.search_type ?? null,
        queryTimeMs: (res as any).meta?.query_time_ms ?? null,
        loading: false,
      });
    } catch {
      set({ error: 'Search failed', loading: false });
    }
  },

  searchAdvanced: async () => {
    const { query, domains, weights } = get();
    if (!query.trim()) return;
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20',
        w_heat: String(weights.heat),
        w_semantic: String(weights.semantic),
        w_fulltext: String(weights.fulltext),
        w_graph: String(weights.graph),
      });
      if (domains.length > 0) params.set('domains', domains.join(','));
      const res = await api.get<{ data: SearchResult[]; meta: Record<string, unknown> }>(
        `/search/advanced?${params}`,
      );
      set({
        results: res.data ?? [],
        total: (res as any).meta?.total ?? 0,
        searchType: (res as any).meta?.search_type ?? null,
        queryTimeMs: (res as any).meta?.query_time_ms ?? null,
        loading: false,
      });
    } catch {
      set({ error: 'Search failed', loading: false });
    }
  },

  setWeights: (w) => {
    const s = get();
    const changedKey = Object.keys(w)[0] as keyof SearchWeights;
    const clamped = Math.max(0, Math.min(1, w[changedKey]!));
    const remaining = 1 - clamped;
    const otherKeys = (['semantic', 'fulltext', 'heat', 'graph'] as const).filter(k => k !== changedKey);
    const otherSum = otherKeys.reduce((acc, k) => acc + s.weights[k], 0);
    const updated = { ...s.weights, [changedKey]: clamped };
    if (otherSum > 0) {
      for (const k of otherKeys) updated[k] = (s.weights[k] / otherSum) * remaining;
    } else {
      for (const k of otherKeys) updated[k] = remaining / otherKeys.length;
    }
    set({ weights: updated });
    // Auto-trigger advanced search when weights change (debounced)
    if (s.query.trim()) {
      if (_weightsDebounce) clearTimeout(_weightsDebounce);
      _weightsDebounce = setTimeout(() => get().searchAdvanced(), 400);
    }
  },
  resetWeights: () => {
    set({ weights: { ...DEFAULT_SEARCH_WEIGHTS } });
    // Auto-trigger search after reset
    const { query } = get();
    if (query.trim()) {
      setTimeout(() => get().searchAdvanced(), 0);
    }
  },
  setSortBy: (sortBy) => set({ sortBy }),
  setSelectedResult: (r) => set({ selectedResult: r }),
  clear: () => set({
    query: '', results: [], total: 0, error: null, searchType: null,
    queryTimeMs: null, selectedResult: null,
  }),
}));

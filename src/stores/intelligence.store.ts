import { create } from 'zustand';
import { api } from '@/services/api';
import type {
  SimilarItem, GraphSubgraph, GraphStats, MergeCandidate, GraphProximityItem,
} from '@/types/intelligence';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface IntelligenceState {
  // Similar items cache
  similarCache: Map<string, CacheEntry<SimilarItem[]>>;

  // Graph proximity cache
  proximityCache: Map<string, CacheEntry<GraphProximityItem[]>>;

  // Graph health
  graphStats: GraphStats | null;
  graphStatsLoading: boolean;
  mergeCandidates: MergeCandidate[];
  mergeCandidatesLoading: boolean;

  // Actions
  fetchSimilar: (sourceType: string, sourceId: string, limit?: number) => Promise<SimilarItem[]>;
  fetchGraphProximity: (sourceType: string, sourceId: string) => Promise<GraphProximityItem[]>;
  fetchGraphStats: () => Promise<void>;
  fetchMergeCandidates: (type?: string) => Promise<void>;
  dismissMerge: (entityAId: string, entityBId: string) => Promise<void>;
  mergeEntities: (keepId: string, mergeId: string) => Promise<void>;
  cleanupOrphans: () => Promise<{ deleted_count: number }>;
  fetchSubgraph: (opts?: { limit?: number; centerId?: string }) => Promise<GraphSubgraph>;
  fetchRecordSubgraph: (opts?: { limit?: number; centerId?: string; centerType?: string }) => Promise<GraphSubgraph>;
}

export const useIntelligenceStore = create<IntelligenceState>()((set, get) => ({
  similarCache: new Map(),
  proximityCache: new Map(),
  graphStats: null,
  graphStatsLoading: false,
  mergeCandidates: [],
  mergeCandidatesLoading: false,

  fetchSimilar: async (sourceType, sourceId, limit = 3) => {
    const key = `${sourceType}:${sourceId}:${limit}`;
    const cached = get().similarCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    try {
      const res = await api.get<{ data: SimilarItem[] }>(
        `/similar?source_type=${sourceType}&source_id=${sourceId}&limit=${limit}`,
      );
      const raw = (res as any).data;
      const items: SimilarItem[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      set(s => {
        const cache = new Map(s.similarCache);
        cache.set(key, { data: items, timestamp: Date.now() });
        return { similarCache: cache };
      });
      return items;
    } catch {
      return [];
    }
  },

  fetchGraphProximity: async (sourceType, sourceId) => {
    const key = `${sourceType}:${sourceId}`;
    const cached = get().proximityCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    try {
      const res = await api.get<{ data: { links: GraphProximityItem[] } }>(
        `/graph/entities?source_type=${sourceType}&source_id=${sourceId}`,
      );
      const items = (res as any).data?.links ?? (res as any).links ?? [];
      set(s => {
        const cache = new Map(s.proximityCache);
        cache.set(key, { data: items, timestamp: Date.now() });
        return { proximityCache: cache };
      });
      return items;
    } catch {
      return [];
    }
  },

  fetchGraphStats: async () => {
    set({ graphStatsLoading: true });
    try {
      const res = await api.get<{ data: GraphStats }>('/graph/stats');
      set({ graphStats: res.data, graphStatsLoading: false });
    } catch {
      set({ graphStatsLoading: false });
    }
  },

  fetchMergeCandidates: async (type?: string) => {
    set({ mergeCandidatesLoading: true });
    try {
      const qs = type ? `?type=${type}` : '';
      const res = await api.get<{ data: { candidates: MergeCandidate[] } }>(`/graph/merge-candidates${qs}`);
      set({ mergeCandidates: (res as any).data?.candidates ?? (res as any).candidates ?? [], mergeCandidatesLoading: false });
    } catch {
      set({ mergeCandidatesLoading: false });
    }
  },

  dismissMerge: async (entityAId, entityBId) => {
    await api.post('/graph/merge-candidates/dismiss', { entity_a_id: entityAId, entity_b_id: entityBId });
    set(s => ({
      mergeCandidates: s.mergeCandidates.filter(
        c => !(c.entity_a_id === entityAId && c.entity_b_id === entityBId),
      ),
    }));
  },

  mergeEntities: async (keepId, mergeId) => {
    await api.post('/graph/merge', { keep_id: keepId, merge_id: mergeId });
    set(s => ({
      mergeCandidates: s.mergeCandidates.filter(
        c => c.entity_a_id !== mergeId && c.entity_b_id !== mergeId,
      ),
    }));
  },

  cleanupOrphans: async () => {
    const res = await api.post<{ data: { deleted_count: number } }>('/graph/cleanup', {});
    return (res as any).data ?? res;
  },

  fetchSubgraph: async (opts) => {
    try {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.centerId) params.set('center_entity_id', opts.centerId);
      const qs = params.toString() ? `?${params}` : '';
      const res = await api.get<{ data: GraphSubgraph }>(`/graph/subgraph${qs}`);
      return (res as any).data ?? res;
    } catch {
      return { nodes: [], edges: [], meta: { total_entities: 0, total_edges: 0, returned_entities: 0, returned_edges: 0 } };
    }
  },

  fetchRecordSubgraph: async (opts) => {
    try {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.centerId) params.set('center_record_id', opts.centerId);
      if (opts?.centerType) params.set('center_record_type', opts.centerType);
      const qs = params.toString() ? `?${params}` : '';
      const res = await api.get<{ data: GraphSubgraph }>(`/graph/record-subgraph${qs}`);
      return (res as any).data ?? res;
    } catch {
      return { nodes: [], edges: [], meta: { total_entities: 0, total_edges: 0, returned_entities: 0, returned_edges: 0 } };
    }
  },
}));

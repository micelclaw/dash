import { create } from 'zustand';
import { api } from '@/services/api';

import type { Photo } from '@/types/files';

// ─── Types ──────────────────────────────────────────────

export interface PhotoSearchResult {
  id: string;
  filename: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SimilarPhotoResult {
  id: string;
  filename: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface FaceCluster {
  id: string;
  name: string | null;
  representative_file_id: string | null;
  photo_count: number;
  linked_contact_id: string | null;
  created_at: string;
}

interface SearchMeta {
  total: number;
  limit: number;
  offset: number;
  search_type: 'semantic' | 'fulltext';
}

interface SimilarMeta {
  total: number;
  limit: number;
  mode: 'visual' | 'concept';
}

// ─── Store ──────────────────────────────────────────────

interface PhotoAiState {
  // Search
  searchResults: PhotoSearchResult[] | null;
  searchLoading: boolean;
  searchMeta: SearchMeta | null;

  // Similar photos panel
  similarPanelOpen: boolean;
  similarMode: 'visual' | 'concept';
  similarResults: SimilarPhotoResult[] | null;
  similarLoading: boolean;
  similarFileId: string | null;

  // Face clusters
  faceClusters: FaceCluster[] | null;
  faceClustersLoading: boolean;
  selectedClusterId: string | null;
  clusterPhotos: Photo[] | null;
  clusterPhotosLoading: boolean;

  // Actions
  searchPhotos: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchSimilar: (fileId: string, mode?: 'visual' | 'concept') => Promise<void>;
  setSimilarMode: (mode: 'visual' | 'concept') => void;
  closeSimilarPanel: () => void;
  fetchFaceClusters: () => Promise<void>;
  selectCluster: (id: string | null) => void;
  fetchClusterPhotos: (clusterId: string) => Promise<void>;
  renameFaceCluster: (clusterId: string, name: string) => Promise<void>;
  mergeFaceClusters: (targetId: string, sourceId: string) => Promise<void>;
  deleteFaceCluster: (clusterId: string) => Promise<void>;
}

export const usePhotoAiStore = create<PhotoAiState>()((set, get) => ({
  searchResults: null,
  searchLoading: false,
  searchMeta: null,

  similarPanelOpen: false,
  similarMode: 'visual',
  similarResults: null,
  similarLoading: false,
  similarFileId: null,

  faceClusters: null,
  faceClustersLoading: false,
  selectedClusterId: null,
  clusterPhotos: null,
  clusterPhotosLoading: false,

  searchPhotos: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: null, searchMeta: null, searchLoading: false });
      return;
    }
    set({ searchLoading: true });
    try {
      const res = await api.get<{ data: PhotoSearchResult[]; meta: SearchMeta }>('/photos/search', {
        q: query,
        limit: 60,
      });
      set({ searchResults: res.data, searchMeta: res.meta, searchLoading: false });
    } catch {
      set({ searchResults: [], searchMeta: null, searchLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: null, searchMeta: null, searchLoading: false });
  },

  fetchSimilar: async (fileId: string, mode?: 'visual' | 'concept') => {
    const m = mode ?? get().similarMode;
    set({ similarPanelOpen: true, similarLoading: true, similarFileId: fileId, similarMode: m });
    try {
      const res = await api.get<{ data: SimilarPhotoResult[]; meta: SimilarMeta }>(
        `/photos/similar/${fileId}`,
        { mode: m, limit: 20 },
      );
      set({ similarResults: res.data, similarLoading: false });
    } catch {
      set({ similarResults: [], similarLoading: false });
    }
  },

  setSimilarMode: (mode: 'visual' | 'concept') => {
    const fileId = get().similarFileId;
    if (fileId) {
      get().fetchSimilar(fileId, mode);
    } else {
      set({ similarMode: mode });
    }
  },

  closeSimilarPanel: () => {
    set({ similarPanelOpen: false, similarResults: null, similarFileId: null });
  },

  // ─── Face Clusters ──────────────────────────────────────

  fetchFaceClusters: async () => {
    set({ faceClustersLoading: true });
    try {
      const res = await api.get<{ data: FaceCluster[] }>('/photos/faces', { limit: 200 });
      set({ faceClusters: res.data, faceClustersLoading: false });
    } catch {
      set({ faceClusters: [], faceClustersLoading: false });
    }
  },

  selectCluster: (id: string | null) => {
    set({ selectedClusterId: id, clusterPhotos: null });
    if (id) get().fetchClusterPhotos(id);
  },

  fetchClusterPhotos: async (clusterId: string) => {
    set({ clusterPhotosLoading: true });
    try {
      const res = await api.get<{ data: Photo[] }>(`/photos/faces/${clusterId}`, { limit: 100 });
      set({ clusterPhotos: res.data, clusterPhotosLoading: false });
    } catch {
      set({ clusterPhotos: [], clusterPhotosLoading: false });
    }
  },

  renameFaceCluster: async (clusterId: string, name: string) => {
    await api.patch(`/photos/faces/${clusterId}`, { name });
    const clusters = get().faceClusters;
    if (clusters) {
      set({ faceClusters: clusters.map((c) => (c.id === clusterId ? { ...c, name } : c)) });
    }
  },

  mergeFaceClusters: async (targetId: string, sourceId: string) => {
    await api.post(`/photos/faces/${targetId}/merge`, { source_cluster_id: sourceId });
    // Re-fetch clusters after merge
    get().fetchFaceClusters();
  },

  deleteFaceCluster: async (clusterId: string) => {
    await api.delete(`/photos/faces/${clusterId}`);
    const clusters = get().faceClusters;
    if (clusters) {
      set({
        faceClusters: clusters.filter((c) => c.id !== clusterId),
        selectedClusterId: get().selectedClusterId === clusterId ? null : get().selectedClusterId,
      });
    }
  },
}));

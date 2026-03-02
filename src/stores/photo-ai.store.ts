import { create } from 'zustand';
import { api } from '@/services/api';

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

  // Actions
  searchPhotos: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchSimilar: (fileId: string, mode?: 'visual' | 'concept') => Promise<void>;
  setSimilarMode: (mode: 'visual' | 'concept') => void;
  closeSimilarPanel: () => void;
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
}));

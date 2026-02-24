import { create } from 'zustand';
import { api } from '@/services/api';

export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  domain: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  auto_summary: string | null;
  is_alive: boolean;
  last_checked_at: string | null;
  tags: string[];
  source: string;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BookmarksState {
  bookmarks: Bookmark[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: {
    search: string;
    tag: string | null;
    domain: string | null;
    isAlive: boolean | null;
  };
  allTags: string[];
  allDomains: string[];
  selectedIds: Set<string>;
  checkingAlive: boolean;

  fetchBookmarks: () => Promise<void>;
  fetchMeta: () => Promise<void>;
  createBookmark: (data: { url: string; title?: string; description?: string; tags?: string[] }) => Promise<Bookmark>;
  updateBookmark: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  restoreBookmark: (id: string) => Promise<void>;
  checkAlive: (ids?: string[]) => Promise<void>;
  setFilter: (key: string, value: unknown) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

export const useBookmarksStore = create<BookmarksState>()((set, get) => ({
  bookmarks: [],
  total: 0,
  loading: false,
  error: null,
  filters: { search: '', tag: null, domain: null, isAlive: null },
  allTags: [],
  allDomains: [],
  selectedIds: new Set(),
  checkingAlive: false,

  fetchBookmarks: async () => {
    set({ loading: true, error: null });
    try {
      const f = get().filters;
      const params: Record<string, string | number | boolean | undefined> = {
        limit: 50,
        offset: 0,
      };
      if (f.search) params.search = f.search;
      if (f.tag) params.tag = f.tag;
      if (f.domain) params.domain = f.domain;
      if (f.isAlive !== null) params.is_alive = f.isAlive;

      const res = await api.get<{ data: Bookmark[]; meta: { total: number } }>('/bookmarks', params);
      set({ bookmarks: res.data, total: res.meta.total, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch bookmarks', loading: false });
    }
  },

  fetchMeta: async () => {
    try {
      const [tagsRes, domainsRes] = await Promise.all([
        api.get<{ data: string[] }>('/bookmarks/tags'),
        api.get<{ data: string[] }>('/bookmarks/domains'),
      ]);
      set({ allTags: tagsRes.data, allDomains: domainsRes.data });
    } catch { /* ignore */ }
  },

  createBookmark: async (data) => {
    const res = await api.post<{ data: Bookmark }>('/bookmarks', data);
    set((s) => ({ bookmarks: [res.data, ...s.bookmarks], total: s.total + 1 }));
    get().fetchMeta();
    return res.data;
  },

  updateBookmark: async (id, data) => {
    const res = await api.patch<{ data: Bookmark }>(`/bookmarks/${id}`, data);
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => (b.id === id ? res.data : b)),
    }));
  },

  deleteBookmark: async (id) => {
    await api.delete(`/bookmarks/${id}`);
    set((s) => ({
      bookmarks: s.bookmarks.filter((b) => b.id !== id),
      total: s.total - 1,
      selectedIds: new Set([...s.selectedIds].filter((i) => i !== id)),
    }));
  },

  restoreBookmark: async (id) => {
    const res = await api.post<{ data: Bookmark }>(`/bookmarks/${id}/restore`);
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => (b.id === id ? res.data : b)),
    }));
  },

  checkAlive: async (ids) => {
    set({ checkingAlive: true });
    try {
      await api.post('/bookmarks/check-alive', ids ? { ids } : {});
      await get().fetchBookmarks();
    } finally {
      set({ checkingAlive: false });
    }
  },

  setFilter: (key, value) => {
    set((s) => ({
      filters: { ...s.filters, [key]: value },
    }));
    get().fetchBookmarks();
  },

  toggleSelect: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  selectAll: () => {
    set((s) => ({
      selectedIds: new Set(s.bookmarks.map((b) => b.id)),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },
}));

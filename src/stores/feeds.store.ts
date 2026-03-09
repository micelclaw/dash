import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ───────────────────────────────────────────────

export interface RssFeed {
  id: string;
  title: string;
  description: string | null;
  feed_url: string;
  site_url: string | null;
  icon_url: string | null;
  category: string | null;
  content_type: 'blog' | 'youtube' | 'podcast';
  fetch_interval: number;
  last_fetched_at: string | null;
  last_error: string | null;
  error_count: number;
  article_count: number;
  unread_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface RssArticle {
  id: string;
  feed_id: string;
  guid: string;
  title: string;
  author: string | null;
  url: string;
  summary: string | null;
  content_html: string | null;
  content_text: string | null;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: boolean;
  read_at: string | null;
  is_favorite: boolean;
  favorited_at: string | null;
  media_url: string | null;
  media_type: string | null;
  media_duration: number | null;
  ai_summary: string | null;
  ai_tags: string[] | null;
  full_text_fetched: boolean;
  tags: string[] | null;
  created_at: string;
}

export interface RssCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  collapsed: boolean;
}

export type ViewMode = 'all' | 'favorites' | string; // feedId or categoryId

// ─── Store ───────────────────────────────────────────────

interface FeedsState {
  feeds: RssFeed[];
  categories: RssCategory[];
  articles: RssArticle[];
  totalArticles: number;
  activeFeedId: string | null;
  activeArticleId: string | null;
  viewMode: ViewMode;
  layout: 'three-column' | 'two-column';
  loading: boolean;
  loadingArticles: boolean;
  error: string | null;
  filters: {
    isRead?: boolean;
    contentType?: string;
    search?: string;
  };
  totalUnread: number;
  unreadByFeed: Record<string, number>;

  // Actions
  fetchFeeds: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchArticles: (append?: boolean) => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  selectFeed: (feedId: string | null) => void;
  selectArticle: (articleId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setLayout: (layout: 'three-column' | 'two-column') => void;
  setFilter: (key: string, value: unknown) => void;
  toggleRead: (articleId: string, isRead: boolean) => Promise<void>;
  toggleFavorite: (articleId: string) => Promise<void>;
  markAllRead: (scope?: { feedId?: string; category?: string }) => Promise<void>;
  subscribe: (url: string, category?: string) => Promise<RssFeed>;
  unsubscribe: (feedId: string) => Promise<void>;
  refreshFeed: (feedId: string) => Promise<void>;
  fetchFullText: (articleId: string) => Promise<void>;
  summarizeArticle: (articleId: string) => Promise<string>;
}

export const useFeedsStore = create<FeedsState>()((set, get) => ({
  feeds: [],
  categories: [],
  articles: [],
  totalArticles: 0,
  activeFeedId: null,
  activeArticleId: null,
  viewMode: 'all',
  layout: 'three-column',
  loading: false,
  loadingArticles: false,
  error: null,
  filters: {},
  totalUnread: 0,
  unreadByFeed: {},

  fetchFeeds: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: RssFeed[] }>('/feeds');
      set({ feeds: res.data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch feeds', loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const res = await api.get<{ data: RssCategory[] }>('/feeds/categories');
      set({ categories: res.data });
    } catch { /* ignore */ }
  },

  fetchArticles: async (append = false) => {
    const state = get();
    set({ loadingArticles: true });
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        limit: 50,
        offset: append ? state.articles.length : 0,
      };

      if (state.viewMode === 'favorites') {
        params.is_favorite = true;
      } else if (state.viewMode !== 'all') {
        // Could be feedId or category
        const isFeed = state.feeds.some(f => f.id === state.viewMode);
        if (isFeed) {
          params.feed_id = state.viewMode;
        } else {
          params.category = state.viewMode;
        }
      }

      if (state.filters.isRead !== undefined) params.is_read = state.filters.isRead;
      if (state.filters.contentType) params.content_type = state.filters.contentType;
      if (state.filters.search) params.search = state.filters.search;

      const res = await api.get<{ data: RssArticle[]; meta: { total: number } }>('/feeds/articles', params);
      set({
        articles: append ? [...state.articles, ...res.data] : res.data,
        totalArticles: res.meta.total,
        loadingArticles: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch articles', loadingArticles: false });
    }
  },

  fetchUnreadCounts: async () => {
    try {
      const res = await api.get<{ data: { total: number; by_feed: Record<string, number> } }>('/feeds/unread-counts');
      set({ totalUnread: res.data.total, unreadByFeed: res.data.by_feed });
    } catch { /* ignore */ }
  },

  selectFeed: (feedId) => {
    set({ activeFeedId: feedId, activeArticleId: null, viewMode: feedId || 'all' });
    get().fetchArticles();
  },

  selectArticle: (articleId) => {
    set({ activeArticleId: articleId });
    // Auto mark as read
    if (articleId) {
      const article = get().articles.find(a => a.id === articleId);
      if (article && !article.is_read) {
        get().toggleRead(articleId, true);
      }
    }
  },

  setViewMode: (mode) => {
    set({ viewMode: mode, activeArticleId: null, activeFeedId: mode !== 'all' && mode !== 'favorites' ? mode : null });
    get().fetchArticles();
  },

  setLayout: (layout) => set({ layout }),

  setFilter: (key, value) => {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
    get().fetchArticles();
  },

  toggleRead: async (articleId, isRead) => {
    const endpoint = isRead ? 'read' : 'unread';
    await api.patch(`/feeds/articles/${articleId}/${endpoint}`);
    set((s) => ({
      articles: s.articles.map(a => a.id === articleId ? { ...a, is_read: isRead } : a),
    }));
    get().fetchUnreadCounts();
  },

  toggleFavorite: async (articleId) => {
    const res = await api.patch<{ data: { is_favorite: boolean } }>(`/feeds/articles/${articleId}/favorite`);
    set((s) => ({
      articles: s.articles.map(a => a.id === articleId ? { ...a, is_favorite: res.data.is_favorite } : a),
    }));
  },

  markAllRead: async (scope) => {
    await api.post('/feeds/articles/mark-all-read', scope ? { feed_id: scope.feedId, category: scope.category } : {});
    set((s) => ({
      articles: s.articles.map(a => ({ ...a, is_read: true })),
    }));
    get().fetchUnreadCounts();
  },

  subscribe: async (url, category) => {
    const res = await api.post<{ data: RssFeed }>('/feeds', { url, category });
    set((s) => ({ feeds: [...s.feeds, res.data] }));
    get().fetchUnreadCounts();
    return res.data;
  },

  unsubscribe: async (feedId) => {
    await api.delete(`/feeds/${feedId}`);
    set((s) => ({
      feeds: s.feeds.filter(f => f.id !== feedId),
      articles: s.articles.filter(a => a.feed_id !== feedId),
      activeFeedId: s.activeFeedId === feedId ? null : s.activeFeedId,
      viewMode: s.viewMode === feedId ? 'all' : s.viewMode,
    }));
    get().fetchUnreadCounts();
  },

  refreshFeed: async (feedId) => {
    await api.post(`/feeds/${feedId}/refresh`);
    get().fetchArticles();
    get().fetchUnreadCounts();
  },

  fetchFullText: async (articleId) => {
    const res = await api.post<{ data: { content_html: string; content_text: string } }>(`/feeds/articles/${articleId}/fetch-full`);
    set((s) => ({
      articles: s.articles.map(a => a.id === articleId ? {
        ...a,
        content_html: res.data.content_html,
        content_text: res.data.content_text,
        full_text_fetched: true,
      } : a),
    }));
  },

  summarizeArticle: async (articleId) => {
    const res = await api.post<{ data: { summary: string } }>(`/feeds/articles/${articleId}/summarize`);
    set((s) => ({
      articles: s.articles.map(a => a.id === articleId ? { ...a, ai_summary: res.data.summary } : a),
    }));
    return res.data.summary;
  },
}));

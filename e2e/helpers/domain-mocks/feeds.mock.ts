import type { MockRoute } from '../api-spy';

const FEED_1 = {
  id: 'feed-1',
  title: 'Hacker News',
  url: 'https://news.ycombinator.com/rss',
  category_id: null,
  unread_count: 5,
  last_refreshed_at: '2026-03-26T06:00:00Z',
};

const ARTICLE_1 = {
  id: 'article-1',
  feed_id: 'feed-1',
  title: 'Show HN: New Tool',
  url: 'https://example.com',
  is_read: false,
  is_starred: false,
  published_at: '2026-03-26T05:00:00Z',
};

export const feedsMocks: MockRoute[] = [
  // List feeds
  {
    method: 'GET',
    path: '/feeds',
    response: { data: [FEED_1], meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single feed
  {
    method: 'GET',
    path: '/feeds/*',
    response: { data: FEED_1 },
  },
  // List articles
  {
    method: 'GET',
    path: '/feeds/articles',
    response: { data: [ARTICLE_1], meta: { total: 1, limit: 50, offset: 0 } },
  },
  // List categories
  {
    method: 'GET',
    path: '/feeds/categories',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Unread counts
  {
    method: 'GET',
    path: '/feeds/unread-counts',
    response: { data: {} },
  },
  // Create feed
  {
    method: 'POST',
    path: '/feeds',
    response: {
      data: {
        id: 'feed-new',
        title: 'New Feed',
        url: 'https://example.com/rss',
        category_id: null,
        unread_count: 0,
        last_refreshed_at: null,
      },
    },
  },
  // Refresh feed
  {
    method: 'POST',
    path: '/feeds/**/refresh',
    response: { data: { refreshed: true } },
  },
  // Mark all read
  {
    method: 'POST',
    path: '/feeds/articles/mark-all-read',
    response: { data: { marked: 5 } },
  },
  // Update article (read/starred)
  {
    method: 'PATCH',
    path: '/feeds/articles/**',
    response: { data: { ...ARTICLE_1, is_read: true } },
  },
  // Update feed
  {
    method: 'PATCH',
    path: '/feeds/*',
    response: { data: { ...FEED_1, updated_at: new Date().toISOString() } },
  },
  // Delete feed
  {
    method: 'DELETE',
    path: '/feeds/*',
    status: 204,
    response: null,
  },
];

import type { MockRoute } from '../api-spy';

const BOOKMARK_1 = {
  id: 'bm-001',
  url: 'https://example.com',
  title: 'Example Site',
  description: 'An example bookmark',
  tags: ['test', 'e2e'],
  favicon_url: null,
  is_alive: true,
  domain: 'example.com',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

const BOOKMARK_2 = {
  id: 'bm-002',
  url: 'https://docs.test.com',
  title: 'Test Docs',
  description: 'Documentation for testing',
  tags: ['docs'],
  favicon_url: null,
  is_alive: true,
  domain: 'docs.test.com',
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

export const BOOKMARKS_LIST = [BOOKMARK_1, BOOKMARK_2];

export const bookmarksMocks: MockRoute[] = [
  // List bookmarks
  {
    method: 'GET',
    path: '/bookmarks',
    response: { data: BOOKMARKS_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get tags
  {
    method: 'GET',
    path: '/bookmarks/tags',
    response: { data: ['test', 'e2e', 'docs'] },
  },
  // Get domains
  {
    method: 'GET',
    path: '/bookmarks/domains',
    response: { data: ['example.com', 'docs.test.com'] },
  },
  // Fetch metadata
  {
    method: 'POST',
    path: '/bookmarks/fetch-metadata',
    response: { data: { title: 'Fetched Title', description: 'Fetched description', favicon_url: null } },
  },
  // Create bookmark
  {
    method: 'POST',
    path: '/bookmarks',
    response: {
      data: {
        id: 'bm-new',
        url: 'https://new-bookmark.com',
        title: 'New Bookmark',
        description: '',
        tags: [],
        favicon_url: null,
        is_alive: true,
        domain: 'new-bookmark.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Update bookmark
  {
    method: 'PATCH',
    path: '/bookmarks/*',
    response: { data: { ...BOOKMARK_1, updated_at: new Date().toISOString() } },
  },
  // Delete bookmark
  {
    method: 'DELETE',
    path: '/bookmarks/*',
    response: { data: { id: BOOKMARK_1.id, deleted: true } },
  },
  // Check alive
  {
    method: 'POST',
    path: '/bookmarks/check-alive',
    response: { data: { checked: 2, alive: 2, dead: 0 } },
  },
  // Restore
  {
    method: 'POST',
    path: '/bookmarks/*/restore',
    response: { data: BOOKMARK_1 },
  },
];

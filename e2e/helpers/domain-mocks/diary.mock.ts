import type { MockRoute } from '../api-spy';

const DIARY_1 = {
  id: 'diary-1',
  entry_date: '2026-03-26',
  content: '<p>Today was productive</p>',
  mood: 'good',
  tags: ['work', 'coding'],
  is_draft: false,
  created_at: '2026-03-26T08:00:00Z',
  updated_at: '2026-03-26T20:00:00Z',
};

const DIARY_2 = {
  id: 'diary-2',
  entry_date: '2026-03-25',
  content: '<p>Relaxing day</p>',
  mood: 'great',
  tags: ['personal'],
  is_draft: false,
  created_at: '2026-03-25T08:00:00Z',
};

export const DIARY_LIST = [DIARY_1, DIARY_2];

export const diaryMocks: MockRoute[] = [
  // List diary entries
  {
    method: 'GET',
    path: '/diary',
    response: { data: DIARY_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get single entry
  {
    method: 'GET',
    path: '/diary/*',
    response: { data: DIARY_1 },
  },
  // Get entry by date
  {
    method: 'GET',
    path: '/diary/date/*',
    response: { data: DIARY_1 },
  },
  // Create entry
  {
    method: 'POST',
    path: '/diary',
    response: {
      data: {
        id: 'diary-new',
        entry_date: new Date().toISOString().split('T')[0],
        content: '',
        mood: 'neutral',
        tags: [],
        is_draft: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Update entry
  {
    method: 'PATCH',
    path: '/diary/*',
    response: { data: { ...DIARY_1, updated_at: new Date().toISOString() } },
  },
  // Delete entry
  {
    method: 'DELETE',
    path: '/diary/*',
    status: 204,
    response: {},
  },
  // Restore entry
  {
    method: 'POST',
    path: '/diary/**/restore',
    response: { data: { ...DIARY_1, deleted_at: null } },
  },
  // Generate narrative
  {
    method: 'POST',
    path: '/diary/**/narrative',
    response: { data: { content: 'AI generated narrative', is_draft: true } },
  },
];

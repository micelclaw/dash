import type { MockRoute } from '../api-spy';

const NOTE_1 = {
  id: 'note-001',
  title: 'Test Note Alpha',
  content: '<p>Hello world</p>',
  content_format: 'html',
  tags: ['test', 'e2e'],
  pinned: false,
  archived: false,
  source: 'manual',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

const NOTE_2 = {
  id: 'note-002',
  title: 'Test Note Beta',
  content: '<p>Second note</p>',
  content_format: 'html',
  tags: ['test'],
  pinned: true,
  archived: false,
  source: 'manual',
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

export const NOTES_LIST = [NOTE_1, NOTE_2];

export const notesMocks: MockRoute[] = [
  // List notes
  {
    method: 'GET',
    path: '/notes',
    response: { data: NOTES_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get single note
  {
    method: 'GET',
    path: '/notes/*',
    response: { data: NOTE_1 },
  },
  // Create note
  {
    method: 'POST',
    path: '/notes',
    response: {
      data: {
        id: 'note-new',
        title: '',
        content: '',
        content_format: 'html',
        tags: [],
        pinned: false,
        archived: false,
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Update note
  {
    method: 'PATCH',
    path: '/notes/*',
    response: { data: { ...NOTE_1, updated_at: new Date().toISOString() } },
  },
  // Delete note
  {
    method: 'DELETE',
    path: '/notes/*',
    response: { data: { id: NOTE_1.id, deleted: true } },
  },
  // Archive / unarchive / restore
  {
    method: 'POST',
    path: '/notes/**',
    response: { data: { ...NOTE_1, archived: true } },
  },
];

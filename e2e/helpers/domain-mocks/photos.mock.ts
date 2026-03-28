import type { MockRoute } from '../api-spy';

const PHOTO_1 = {
  id: 'photo-1',
  filename: 'sunset.jpg',
  mime_type: 'image/jpeg',
  size: 1048576,
  width: 1920,
  height: 1080,
  created_at: '2026-03-20T10:00:00Z',
};

const ALBUM_1 = {
  id: 'album-1',
  title: 'Vacation',
  cover_photo_id: 'photo-1',
  photo_count: 5,
  created_at: '2026-03-15T10:00:00Z',
};

export const PHOTOS_LIST = [PHOTO_1];
export const ALBUMS_LIST = [ALBUM_1];

export const photosMocks: MockRoute[] = [
  // List photos
  {
    method: 'GET',
    path: '/photos/timeline',
    response: { data: PHOTOS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // List albums
  {
    method: 'GET',
    path: '/albums',
    response: { data: ALBUMS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single album
  {
    method: 'GET',
    path: '/albums/*',
    response: { data: ALBUM_1 },
  },
  // Create album
  {
    method: 'POST',
    path: '/albums',
    response: {
      data: {
        id: 'album-new',
        title: 'New Album',
        cover_photo_id: null,
        photo_count: 0,
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update album
  {
    method: 'PATCH',
    path: '/albums/*',
    response: { data: { ...ALBUM_1, updated_at: new Date().toISOString() } },
  },
  // Delete album
  {
    method: 'DELETE',
    path: '/albums/*',
    status: 204,
    response: null,
  },
  // Add photo to album
  {
    method: 'POST',
    path: '/albums/**/photos',
    status: 204,
    response: null,
  },
  // Remove photo from album
  {
    method: 'DELETE',
    path: '/albums/**/photos/*',
    status: 204,
    response: null,
  },
  // Update file metadata
  {
    method: 'PATCH',
    path: '/files/*',
    response: { data: { ...PHOTO_1, updated_at: new Date().toISOString() } },
  },
  // Delete file
  {
    method: 'DELETE',
    path: '/files/*',
    status: 204,
    response: null,
  },
  // AI reprocess selected photos
  {
    method: 'POST',
    path: '/photos/ai/reprocess-selected',
    response: { data: { processed: 1 } },
  },
  // Face recognition
  {
    method: 'GET',
    path: '/photos/faces',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
];

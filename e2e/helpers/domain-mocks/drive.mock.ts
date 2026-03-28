import type { MockRoute } from '../api-spy';

const FILE_1 = {
  id: 'file-1',
  filename: 'document.pdf',
  mime_type: 'application/pdf',
  size: 2048,
  parent_id: null,
  is_directory: false,
  created_at: '2026-03-20T10:00:00Z',
};

const FOLDER_1 = {
  id: 'folder-1',
  filename: 'Projects',
  mime_type: null,
  size: 0,
  parent_id: null,
  is_directory: true,
  created_at: '2026-03-20T10:00:00Z',
};

export const FILES_LIST = [FILE_1, FOLDER_1];

export const driveMocks: MockRoute[] = [
  // List files
  {
    method: 'GET',
    path: '/files',
    response: { data: FILES_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get single file
  {
    method: 'GET',
    path: '/files/*',
    response: { data: FILE_1 },
  },
  // Create file/folder
  {
    method: 'POST',
    path: '/files',
    response: {
      data: {
        id: 'file-new',
        filename: 'new-file.txt',
        mime_type: 'text/plain',
        size: 0,
        parent_id: null,
        is_directory: false,
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update file
  {
    method: 'PATCH',
    path: '/files/*',
    response: { data: { ...FILE_1, updated_at: new Date().toISOString() } },
  },
  // Delete file
  {
    method: 'DELETE',
    path: '/files/*',
    status: 204,
    response: null,
  },
  // Copy file
  {
    method: 'POST',
    path: '/files/**/copy',
    response: {
      data: {
        ...FILE_1,
        id: 'file-copy',
        filename: 'document (copy).pdf',
        created_at: new Date().toISOString(),
      },
    },
  },
];

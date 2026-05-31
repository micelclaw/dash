import type { MockRoute } from '../api-spy';

const DIR_ENTRY = {
  name: 'documents',
  type: 'directory',
  size: 0,
  modified: '2026-03-20T10:00:00Z',
};

const FILE_ENTRY = {
  name: 'readme.txt',
  type: 'file',
  size: 1024,
  modified: '2026-03-19T08:00:00Z',
};

export const EXPLORER_LIST = [DIR_ENTRY, FILE_ENTRY];

export const explorerMocks: MockRoute[] = [
  // Drive files endpoint (default source)
  {
    method: 'GET',
    path: '/files',
    response: { data: [{ id: 'f1', filename: 'readme.txt', mime_type: 'text/plain', size_bytes: 1024, created_at: '2026-03-20T10:00:00Z' }], meta: { total: 1, limit: 50, offset: 0 } },
  },
  // List directory
  {
    method: 'GET',
    path: '/vfs/list',
    response: { data: EXPLORER_LIST },
  },
  // List directory (alternate endpoint used by hook)
  {
    method: 'GET',
    path: '/vfs/list',
    response: { data: EXPLORER_LIST },
  },
  // Create directory
  {
    method: 'POST',
    path: '/vfs/mkdir',
    response: { data: { name: 'new-folder', type: 'directory' } },
  },
  // Copy file/directory
  {
    method: 'POST',
    path: '/vfs/copy',
    response: { data: { copied: 1 } },
  },
  // Move file/directory
  {
    method: 'POST',
    path: '/vfs/move',
    response: { data: { moved: 1 } },
  },
  // Delete file/directory
  {
    method: 'DELETE',
    path: '/vfs/delete',
    status: 204,
    response: null,
  },
  // Create mount
  {
    method: 'POST',
    path: '/vfs/mounts',
    response: { data: { id: 'mount-1', source: '/mnt/usb', target: '/media/usb' } },
  },
  // Delete mount
  {
    method: 'DELETE',
    path: '/vfs/mounts/*',
    status: 204,
    response: null,
  },
  // Stat file
  {
    method: 'GET',
    path: '/vfs/stat',
    response: { data: { name: 'test', type: 'file', size: 100 } },
  },
  // List mounts (used by SourceTree)
  {
    method: 'GET',
    path: '/vfs/mounts',
    response: { data: [] },
  },
];

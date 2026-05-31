import type { MockRoute } from '../api-spy';

const TOOL_FILE_1 = {
  id: 'tool-file-1',
  filename: 'script.sh',
  mime_type: 'text/x-shellscript',
  size: 512,
  size_bytes: 512,
  filepath: '/Tools/Whiteboards/script.sh',
  parent_folder: '/Tools/Whiteboards',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

export const TOOLS_FILES_LIST = [TOOL_FILE_1];

export const toolsMocks: MockRoute[] = [
  // List files (whiteboards)
  {
    method: 'GET',
    path: '/files',
    response: { data: TOOLS_FILES_LIST, meta: { total: 1, limit: 200, offset: 0 } },
  },
  // Get single file
  {
    method: 'GET',
    path: '/files/*',
    response: { data: TOOL_FILE_1 },
  },
  // Update file
  {
    method: 'PATCH',
    path: '/files/*',
    response: { data: { ...TOOL_FILE_1, updated_at: new Date().toISOString() } },
  },
  // Delete file
  {
    method: 'DELETE',
    path: '/files/*',
    status: 204,
    response: null,
  },
];

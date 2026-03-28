import type { MockRoute } from '../api-spy';

const SNIPPET_1 = {
  id: 'snip-1',
  title: 'List files',
  command: 'ls -la',
  created_at: '2026-03-20T10:00:00Z',
};

const CONNECTION_1 = {
  id: 'conn-1',
  name: 'Local',
  host: 'localhost',
  port: 22,
  username: 'root',
};

export const SNIPPETS_LIST = [SNIPPET_1];
export const CONNECTIONS_LIST = [CONNECTION_1];

export const terminalMocks: MockRoute[] = [
  // List snippets
  {
    method: 'GET',
    path: '/terminal/snippets',
    response: { data: SNIPPETS_LIST, meta: { total: 1 } },
  },
  // List connections
  {
    method: 'GET',
    path: '/terminal/connections',
    response: { data: CONNECTIONS_LIST, meta: { total: 1 } },
  },
  // Create snippet
  {
    method: 'POST',
    path: '/terminal/snippets',
    response: {
      data: {
        id: 'snip-new',
        title: '',
        command: '',
        created_at: new Date().toISOString(),
      },
    },
  },
  // Delete snippet
  {
    method: 'DELETE',
    path: '/terminal/snippets/*',
    response: null,
    status: 204,
  },
  // Delete connection
  {
    method: 'DELETE',
    path: '/terminal/connections/*',
    response: null,
    status: 204,
  },
  // Update connection
  {
    method: 'PATCH',
    path: '/terminal/connections/*',
    response: { data: { ...CONNECTION_1, updated_at: new Date().toISOString() } },
  },
];

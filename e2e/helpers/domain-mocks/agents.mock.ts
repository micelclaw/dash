import type { MockRoute } from '../api-spy';

const AGENT_1 = {
  id: 'agent-1',
  name: 'Francis',
  model: 'claude-sonnet-4-20250514',
  status: 'online',
  capabilities: ['search', 'browse'],
  display_name: 'Francis',
  role: 'assistant',
  color: '#F59E0B',
  avatar: null,
  parent_id: null,
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

export const AGENTS_LIST = [AGENT_1];

export const agentsMocks: MockRoute[] = [
  // List managed agents
  {
    method: 'GET',
    path: '/managed-agents',
    response: { data: AGENTS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single agent
  {
    method: 'GET',
    path: '/managed-agents/*',
    response: { data: AGENT_1 },
  },
  // Update agent
  {
    method: 'PATCH',
    path: '/managed-agents/*',
    response: { data: { ...AGENT_1, updated_at: new Date().toISOString() } },
  },
  // Set model
  {
    method: 'POST',
    path: '/managed-agents/**/set-model',
    response: { data: { model: 'claude-sonnet-4-20250514' } },
  },
  // Upload workspace file
  {
    method: 'PUT',
    path: '/managed-agents/**/workspace-file',
    status: 204,
    response: null,
  },
];

import type { MockRoute } from '../api-spy';

const API_KEY_OPENAI = {
  provider: 'openai',
  key_set: true,
};

const API_KEY_ANTHROPIC = {
  provider: 'anthropic',
  key_set: true,
};

export const API_KEYS_LIST = [API_KEY_OPENAI, API_KEY_ANTHROPIC];

const AGENT_TOKEN_1 = {
  id: 'atok-1',
  name: 'Debug Token',
  scopes: ['read:notes', 'read:events'],
  agent_id: null,
  expires_at: null,
  created_at: '2026-03-01T00:00:00Z',
  last_used_at: '2026-03-26T12:00:00Z',
};

const MY_API_KEY_1 = {
  id: 'key-1',
  name: 'My Key',
  prefix: 'ck_abc',
  scopes: ['read'],
  last_used_at: '2026-03-25T10:00:00Z',
  created_at: '2026-02-01T00:00:00Z',
};

const APPROVAL_HISTORY_1 = {
  id: 'ahist-1',
  operation: 'deploy:staging',
  requested_by: 'agent-claw',
  decision: 'approved',
  resolved_by: 'paco@local',
  created_at: '2026-03-20T09:00:00Z',
  resolved_at: '2026-03-20T09:05:00Z',
};

const PREFERENCE_1 = {
  id: 'pref-1',
  description: 'Prefers dark mode for coding sessions',
  confidence: 0.85,
  source: 'behavior',
  created_at: '2026-03-10T00:00:00Z',
};

const DUPLICATE_PAIR_1 = {
  record_a: { id: 'rec-a', domain: 'contacts', title: 'John Doe', subtitle: 'john@example.com' },
  record_b: { id: 'rec-b', domain: 'contacts', title: 'Jon Doe', subtitle: 'jon@example.com' },
  similarity: 0.92,
  domain: 'contacts',
};

export const settingsMocks: MockRoute[] = [
  // List AI API keys
  {
    method: 'GET',
    path: '/settings/ai/api-keys',
    response: { data: API_KEYS_LIST },
  },
  // Update an API key
  {
    method: 'PUT',
    path: '/settings/ai/api-keys/*',
    response: null,
    status: 204,
  },
  // Delete an API key
  {
    method: 'DELETE',
    path: '/settings/ai/api-keys/*',
    response: null,
    status: 204,
  },
  // Test an API key
  {
    method: 'POST',
    path: '/settings/ai/api-keys/**/test',
    response: { data: { valid: true } },
  },

  // ─── Agent Tokens ──────────────────────────────────────────
  {
    method: 'GET',
    path: '/agent-tokens',
    response: { data: [AGENT_TOKEN_1], meta: { total: 1 } },
  },
  {
    method: 'POST',
    path: '/agent-tokens',
    response: { data: { ...AGENT_TOKEN_1, id: 'atok-new', token: 'claw_atok_xxxxx' } },
    status: 201,
  },
  {
    method: 'PATCH',
    path: '/agent-tokens/*',
    response: { data: AGENT_TOKEN_1 },
  },
  {
    method: 'DELETE',
    path: '/agent-tokens/*',
    response: { data: { revoked: true } },
  },

  // ─── My API Keys ──────────────────────────────────────────
  {
    method: 'GET',
    path: '/api-keys/mine',
    response: { data: [MY_API_KEY_1] },
  },

  // ─── Approvals History ────────────────────────────────────
  {
    method: 'GET',
    path: '/approvals/history',
    response: { data: [APPROVAL_HISTORY_1], meta: { total: 1 } },
  },

  // ─── Learned Preferences ─────────────────────────────────
  {
    method: 'GET',
    path: '/preferences',
    response: { data: [PREFERENCE_1] },
  },
  {
    method: 'DELETE',
    path: '/preferences/*',
    response: null,
    status: 204,
  },

  // ─── Sync Duplicates ──────────────────────────────────────
  {
    method: 'GET',
    path: '/sync/duplicates',
    response: { data: [DUPLICATE_PAIR_1] },
  },
  {
    method: 'POST',
    path: '/sync/duplicates/dismiss',
    response: null,
    status: 204,
  },

  // ─── Security config ──────────────────────────────────────
  {
    method: 'GET',
    path: '/security/config',
    response: { data: { two_factor: false, session_timeout: 30 } },
  },
];

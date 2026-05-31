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

// ─── Tool Access (Ola 2) ────────────────────────────────────────────

export const TOOL_ACCESS_RESPONSE = {
  global: {
    profile: 'coding',
    also_allow: [],
    deny: [],
  },
  agent: null,
  effective: {
    enabled_tools: ['session_status', 'message', 'browser', 'exec'],
  },
};

// ─── Advanced config (Ola 2: thinking + reasoning + subagents) ──────

export const ADVANCED_CONFIG_RESPONSE = {
  thinking: {
    default: 'adaptive',
    visibility: 'stream',
    fast_mode: false,
    verbose: 'off',
  },
  reasoning: {
    default: 'stream',
    effort: 'medium',
  },
  context: {
    pruning: { mode: 'auto', soft_trim: 0.7, hard_clear: 0.95 },
    compaction: { mode: 'auto', reserve_tokens: 1000 },
  },
  subagent: {
    max_concurrent: 3,
    max_spawn_depth: 2,
    max_children_per_agent: 5,
    run_timeout_seconds: 600,
    archive_after_minutes: 60,
  },
};

// ─── Available skills ───────────────────────────────────────────────

export const AVAILABLE_SKILLS = [
  { id: 'claw-notes', name: 'claw-notes', description: 'Notes management', source: 'workspace' },
  { id: 'claw-mail',  name: 'claw-mail',  description: 'Email operations',  source: 'workspace' },
];

export const agentsMocks: MockRoute[] = [
  // List managed agents
  {
    method: 'GET',
    path: '/managed-agents',
    response: { data: AGENTS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Available skills (used by AgentSkills modal + tool-access loaders)
  {
    method: 'GET',
    path: '/managed-agents/available-skills',
    response: { data: AVAILABLE_SKILLS },
  },
  // Models list (used by AgentDetail Overview tab)
  {
    method: 'GET',
    path: '/managed-agents/models',
    response: { data: [] },
  },
  // Advanced config (Ola 2)
  {
    method: 'GET',
    path: '/managed-agents/advanced-config',
    response: { data: ADVANCED_CONFIG_RESPONSE },
  },
  {
    method: 'PATCH',
    path: '/managed-agents/advanced-config',
    response: { data: { ok: true } },
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
  // Tool access (Ola 2) — uses ** glob to match /managed-agents/{id}/tool-access
  {
    method: 'GET',
    path: '/managed-agents/**/tool-access',
    response: { data: TOOL_ACCESS_RESPONSE },
  },
  {
    method: 'PATCH',
    path: '/managed-agents/**/tool-access',
    response: { data: { ok: true } },
  },
  // Skills patch (regenerate TOOLS.md + sync to openclaw.json)
  {
    method: 'PATCH',
    path: '/managed-agents/**/skills',
    response: { data: { ok: true } },
  },
  // Upload workspace file
  {
    method: 'PUT',
    path: '/managed-agents/**/workspace-file',
    status: 204,
    response: null,
  },
];

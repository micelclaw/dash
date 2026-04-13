/**
 * Gateway mocks for contract tests.
 *
 * Covers every section of openclaw.json exposed via /gateway/*-config
 * endpoints introduced in OpenClaw Adaptation Olas 1-7, plus runtime
 * operations (cron, devices, logs, channels) and the canvas-host proxy.
 *
 * Pattern: each section has a `<NAME>_CONFIG` constant with realistic
 * default values, plus GET (returns the constant) and PATCH (returns
 * `{ ok: true }`) mock entries. Tests can import the constants when
 * they need to assert specific field values in the response.
 *
 * The base mocks (base.mock.ts) cover /gateway/status, /health,
 * /snapshot, /models, /channels, /sessions — those are NOT duplicated
 * here.
 */

import type { MockRoute } from '../api-spy';

// ─── Cron (Ola 1) ───────────────────────────────────────────────────

const CRON_1 = {
  id: 'cron-1',
  name: 'daily-digest',
  schedule: '0 8 * * *',
  enabled: true,
};

export const CRON_LIST = [CRON_1];

// ─── Logging (Ola 7) ────────────────────────────────────────────────

export const LOGGING_CONFIG = {
  level: 'info',
  console_level: 'info',
  console_style: 'pretty',
  redact_sensitive: 'tools',
  redact_patterns: [],
};

// ─── Telemetry / OTel (Ola 7) ───────────────────────────────────────

export const TELEMETRY_CONFIG = {
  otel: {
    enabled: false,
    endpoint: '',
    protocol: 'http/protobuf',
    headers: {},
    service_name: 'openclaw',
    traces: true,
    metrics: true,
    logs: false,
    sample_rate: 1.0,
    flush_interval_ms: 5000,
  },
  plugin_enabled: false,
};

// ─── UI / Branding (Ola 7) ──────────────────────────────────────────

export const UI_CONFIG = {
  seam_color: '#d4a017',
  assistant: { name: 'Claw', avatar: '' },
};

// ─── Discovery (Ola 7) ──────────────────────────────────────────────

export const DISCOVERY_CONFIG = {
  mdns: { mode: 'minimal' },
  wide_area: { enabled: false, domain: '' },
};

// ─── Canvas Host (Ola 7) ────────────────────────────────────────────

export const CANVAS_CONFIG = {
  enabled: true,
  root: '~/.openclaw/canvas/',
  port: 18793,
  live_reload: true,
};

// ─── Env (Ola 7) ────────────────────────────────────────────────────

export const ENV_CONFIG = {
  shell_env: { enabled: true, timeout_ms: 5000 },
  vars: {},
};

// ─── Secrets (Ola 7, admin-only) ────────────────────────────────────

export const SECRETS_CONFIG = {
  providers: {},
  defaults: {},
};

export const SECRETS_TEST_RESULT = {
  ok: true,
  length: 12,
  duration_ms: 5,
};

// ─── Raw config (Ola 7, admin-only) ─────────────────────────────────

export const RAW_CONFIG = {
  content: '{\n  "version": "test"\n}',
  hash: 'sha256:abc123',
  path: '/home/test/.openclaw/openclaw.json',
};

export const RAW_CONFIG_BACKUPS = [
  {
    filename: 'openclaw.json.2026-04-07T11-30-00.bak',
    path: '/home/test/.openclaw/backups/openclaw.json.2026-04-07T11-30-00.bak',
    size_bytes: 12345,
    created_at: '2026-04-07T11:30:00.000Z',
  },
];

// ─── Sandbox (Ola 4) ────────────────────────────────────────────────

export const SANDBOX_CONFIG = {
  mode: 'non-main',
  scope: 'workspace',
  workspace_access: 'read-write',
  prune: { idle_hours: 24, max_age_days: 7 },
};

// ─── Browser (Ola 4) ────────────────────────────────────────────────

export const BROWSER_CONFIG = {
  enabled: true,
  evaluate_enabled: false,
  headless: true,
  no_sandbox: true,
  default_profile: 'openclaw',
  profiles: { openclaw: { cdp_port: 18800 } },
  ssrf_policy: { allow_private_network: false },
};

// ─── Gateway Auth (Ola 4) ───────────────────────────────────────────

export const AUTH_CONFIG = {
  mode: 'token',
  bind: 'loopback',
  port: 18789,
  tailscale: { mode: 'off' },
  tls: { enabled: false },
  reload: { mode: 'hybrid' },
};

// ─── Devices (Ola 4) ────────────────────────────────────────────────

export const DEVICES_LIST = {
  pending: [],
  paired: [
    {
      id: 'device-1',
      name: 'Mac mini',
      platform: 'darwin',
      created_at: '2026-03-01T00:00:00.000Z',
    },
  ],
};

// ─── Approvals forwarding (Ola 4) ───────────────────────────────────

export const APPROVALS_CONFIG = {
  forwarding: {
    enabled: false,
    mode: 'session',
    targets: [],
  },
};

// ─── Memory search (Ola 5) ──────────────────────────────────────────

export const MEMORY_CONFIG = {
  provider: 'openai',
  hybrid: { vector_weight: 0.7, text_weight: 0.3 },
  mmr: { enabled: false, lambda: 0.5 },
  temporal_decay: { enabled: false, half_life_days: 30 },
  sync: { watch: true, interval_minutes: 5 },
  backend: 'builtin',
};

// ─── Sessions (Ola 5) ───────────────────────────────────────────────

export const SESSION_CONFIG = {
  reset: { mode: 'idle', idle_minutes: 60, at_hour: null },
  thread_bindings: { enabled: true, idle_hours: 6 },
  identity_links: {},
  maintenance: { pruning: 'auto', max_disk_mb: 500 },
};

// ─── Cron config defaults (Ola 5) ───────────────────────────────────

export const CRON_CONFIG = {
  max_concurrent: 3,
  retry: { max_attempts: 3, backoff_seconds: 60, retry_on: ['transient'] },
  alerts: { after_failures: 3, cooldown_minutes: 30, mode: 'channel' },
  retention_days: 30,
};

// ─── Hooks (Ola 5) ──────────────────────────────────────────────────

export const HOOKS_CONFIG = {
  internal: { 'session-memory': { enabled: true } },
  webhooks: { token: '', mappings: [] },
};

// ─── Heartbeat (Ola 5) ──────────────────────────────────────────────

export const HEARTBEAT_CONFIG = {
  defaults: {
    interval_minutes: 60,
    active_hours: { start: 8, end: 22 },
    target_channel: '',
    direct_policy: 'allow',
  },
  per_agent: {},
};

// ─── Skills config + bundled (Ola 6) ────────────────────────────────

export const SKILLS_CONFIG = {
  entries: {},
  load: { extra_dirs: [] },
};

export const BUNDLED_SKILLS = {
  data: [
    { id: 'github', name: 'github', source: 'bundled', has_api_key: false, has_env: false, enabled: true },
    { id: 'slack',  name: 'slack',  source: 'bundled', has_api_key: false, has_env: false, enabled: true },
  ],
};

// ─── Providers + auth profiles + cooldowns (Ola 6) ──────────────────

export const PROVIDERS_CONFIG = {
  models: {
    mode: 'merge',
    providers: {},
  },
  auth: {
    profiles: {},
    order: {},
    cooldowns: {
      billing_backoff_hours: 5,
      billing_max_hours: 24,
      failure_window_hours: 1,
    },
  },
};

// ─── Commands (Ola 6) ───────────────────────────────────────────────

export const COMMANDS_CONFIG = {
  native: 'auto',
  native_skills: 'auto',
  bash: false,
  config: false,
  debug: false,
  restart: true,
};

// ─── Messages config (Ola 3) ────────────────────────────────────────

export const MESSAGES_CONFIG = {
  queue: { mode: 'collect', debounce_ms: 500, cap: 10 },
  streaming: { block: 'on', human_delay: 'natural', typing_mode: 'instant' },
  reactions: { ack: '👀', error: '❌', success: '✅' },
};

// ─── Channel config (per-type, Ola 3) ───────────────────────────────

export const CHANNEL_CONFIG_TELEGRAM = {
  enabled: true,
  bot_token: '••••••••',
  dm_policy: 'pairing',
  group_policy: 'allowlist',
  reply_to_mode: 'first',
  streaming: 'block',
  groups: {},
};

// ─── Config schema (Ola 7 foundation) ───────────────────────────────

export const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    logging: { type: 'object' },
    diagnostics: { type: 'object' },
    ui: { type: 'object' },
    discovery: { type: 'object' },
    canvas_host: { type: 'object' },
    env: { type: 'object' },
    secrets: { type: 'object' },
  },
};

// ─── Mock routes ────────────────────────────────────────────────────

const okPatch = { data: { ok: true } };

export const gatewayMocks: MockRoute[] = [
  // ── Cron (Ola 1) ───────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/cron',         response: { data: CRON_LIST, meta: { total: 1 } } },
  { method: 'POST',   path: '/gateway/cron',         response: { data: CRON_1 } },
  { method: 'PATCH',  path: '/gateway/cron/*',       response: { data: { ...CRON_1, updated_at: new Date().toISOString() } } },
  { method: 'DELETE', path: '/gateway/cron/*',       response: { data: { ok: true } } },
  { method: 'POST',   path: '/gateway/cron/*',       response: { data: { ok: true } } },
  { method: 'GET',    path: '/gateway/cron-config',  response: { data: CRON_CONFIG } },
  { method: 'PATCH',  path: '/gateway/cron-config',  response: okPatch },

  // ── Models add/remove/default (Ola 1) ─────────────────────────
  { method: 'GET',    path: '/gateway/models/catalog',  response: { data: [] } },
  { method: 'POST',   path: '/gateway/models/default',  response: okPatch },
  { method: 'POST',   path: '/gateway/models/add',      response: okPatch },
  { method: 'POST',   path: '/gateway/models/remove',   response: okPatch },

  // ── Sandbox (Ola 4) ────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/sandbox-config', response: { data: SANDBOX_CONFIG } },
  { method: 'PATCH',  path: '/gateway/sandbox-config', response: okPatch },

  // ── Browser (Ola 4) ────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/browser-config', response: { data: BROWSER_CONFIG } },
  { method: 'PATCH',  path: '/gateway/browser-config', response: okPatch },

  // ── Gateway Auth (Ola 4) ───────────────────────────────────────
  { method: 'GET',    path: '/gateway/auth-config',    response: { data: AUTH_CONFIG } },
  { method: 'PATCH',  path: '/gateway/auth-config',    response: okPatch },

  // ── Devices (Ola 4) ────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/devices',                  response: { data: DEVICES_LIST } },
  { method: 'POST',   path: '/gateway/devices/approve',          response: okPatch },
  { method: 'POST',   path: '/gateway/devices/reject',           response: okPatch },
  { method: 'DELETE', path: '/gateway/devices/*',                response: okPatch },
  { method: 'POST',   path: '/gateway/devices/*',                response: { data: { token: 'rotated-token-once' } } },

  // ── Approvals forwarding (Ola 4) ───────────────────────────────
  { method: 'GET',    path: '/gateway/approvals-config', response: { data: APPROVALS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/approvals-config', response: okPatch },

  // ── Memory (Ola 5) ─────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/memory-config',  response: { data: MEMORY_CONFIG } },
  { method: 'PATCH',  path: '/gateway/memory-config',  response: okPatch },

  // ── Sessions (Ola 5) ───────────────────────────────────────────
  { method: 'GET',    path: '/gateway/session-config', response: { data: SESSION_CONFIG } },
  { method: 'PATCH',  path: '/gateway/session-config', response: okPatch },

  // ── Hooks (Ola 5) ──────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/hooks-config',   response: { data: HOOKS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/hooks-config',   response: okPatch },

  // ── Heartbeat (Ola 5) ──────────────────────────────────────────
  { method: 'GET',    path: '/gateway/heartbeat-config', response: { data: HEARTBEAT_CONFIG } },
  { method: 'PATCH',  path: '/gateway/heartbeat-config', response: okPatch },

  // ── Skills (Ola 6) ─────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/bundled-skills', response: BUNDLED_SKILLS },
  { method: 'GET',    path: '/gateway/skills-config',  response: { data: SKILLS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/skills-config',  response: okPatch },

  // ── Providers (Ola 6) ──────────────────────────────────────────
  { method: 'GET',    path: '/gateway/providers-config', response: { data: PROVIDERS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/providers-config', response: okPatch },

  // ── Commands (Ola 6) ───────────────────────────────────────────
  { method: 'GET',    path: '/gateway/commands-config', response: { data: COMMANDS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/commands-config', response: okPatch },

  // ── Messages config (Ola 3) ────────────────────────────────────
  { method: 'GET',    path: '/gateway/messages-config', response: { data: MESSAGES_CONFIG } },
  { method: 'PATCH',  path: '/gateway/messages-config', response: okPatch },

  // ── Channel per-type config (Ola 3) ────────────────────────────
  { method: 'GET',    path: '/gateway/channels/*',     response: { data: CHANNEL_CONFIG_TELEGRAM } },
  { method: 'PATCH',  path: '/gateway/channels/*',     response: okPatch },

  // ── Logging (Ola 7) ────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/logging-config', response: { data: LOGGING_CONFIG } },
  { method: 'PATCH',  path: '/gateway/logging-config', response: okPatch },
  { method: 'GET',    path: '/gateway/logs',           response: { data: [] } },

  // ── Telemetry / OTel (Ola 7) ───────────────────────────────────
  { method: 'GET',    path: '/gateway/telemetry-config',                  response: { data: TELEMETRY_CONFIG } },
  { method: 'PATCH',  path: '/gateway/telemetry-config',                  response: okPatch },
  { method: 'POST',   path: '/gateway/plugins/diagnostics-otel/enable',   response: okPatch },

  // ── UI / Branding (Ola 7) ──────────────────────────────────────
  { method: 'GET',    path: '/gateway/ui-config',      response: { data: UI_CONFIG } },
  { method: 'PATCH',  path: '/gateway/ui-config',      response: okPatch },

  // ── Discovery (Ola 7) ──────────────────────────────────────────
  { method: 'GET',    path: '/gateway/discovery-config', response: { data: DISCOVERY_CONFIG } },
  { method: 'PATCH',  path: '/gateway/discovery-config', response: okPatch },

  // ── Canvas host (Ola 7) ────────────────────────────────────────
  { method: 'GET',    path: '/gateway/canvas-config',  response: { data: CANVAS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/canvas-config',  response: okPatch },

  // ── Env (Ola 7) ────────────────────────────────────────────────
  { method: 'GET',    path: '/gateway/env-config',     response: { data: ENV_CONFIG } },
  { method: 'PATCH',  path: '/gateway/env-config',     response: okPatch },

  // ── Secrets (Ola 7, admin-only) ────────────────────────────────
  { method: 'GET',    path: '/gateway/secrets-config', response: { data: SECRETS_CONFIG } },
  { method: 'PATCH',  path: '/gateway/secrets-config', response: okPatch },
  { method: 'POST',   path: '/gateway/secrets/test',   response: { data: SECRETS_TEST_RESULT } },

  // ── Config schema (Ola 7 foundation) ───────────────────────────
  { method: 'GET',    path: '/gateway/config-schema',  response: { data: CONFIG_SCHEMA } },

  // ── Raw config editor (Ola 7, admin-only) ──────────────────────
  { method: 'GET',    path: '/gateway/raw-config',          response: { data: RAW_CONFIG } },
  { method: 'PUT',    path: '/gateway/raw-config',          response: { data: { ok: true, new_hash: 'sha256:def456', backup: '/path/to/backup.bak' } } },
  { method: 'GET',    path: '/gateway/raw-config/backups',  response: { data: RAW_CONFIG_BACKUPS } },

  // ── Canvas-host proxy (Ola 7) ──────────────────────────────────
  // The /canvas-host/* proxy serves binary HTML, not JSON. Tests that
  // assert "the dash makes a GET to /canvas-host/..." don't need to
  // mock the body — just verify the call. We return a stub HTML body.
  {
    method: 'GET',
    path: '/canvas-host/**',
    response: '<html><body>mock canvas content</body></html>',
  },

  // ── Provisioning helpers ───────────────────────────────────────
  { method: 'POST',   path: '/gateway/sync-user-profile', response: okPatch },
  { method: 'POST',   path: '/gateway/provision-agents',  response: okPatch },
];

/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Gateway Status ─────────────────────────────────────────────────

export interface GatewayStatus {
  running: boolean | undefined;
  version?: string;
  port?: number;
  bind?: string;
  reachable?: boolean;
  service_installed?: boolean;
  service_status?: string;
  channels_connected?: number;
  channel_summary?: string[];
  agents_active?: number;
  agents_total?: number;
  sessions_active?: number;
  models_configured?: number;
  default_model?: string;
  security?: {
    critical: number;
    warnings: number;
  } | null;
  error?: string;
}

// ─── Gateway Health ─────────────────────────────────────────────────

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  latency_ms?: number;
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'down';
  checks: HealthCheck[];
  error?: string;
}

// ─── Channels ───────────────────────────────────────────────────────

export type ChannelType =
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'signal'
  | 'mattermost'
  | 'googlechat'
  | 'imessage'
  | 'msteams'
  | 'webchat'
  | 'rest';

export type ChannelStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'login_required';

export interface GatewayChannel {
  type: ChannelType | string;
  account: string;
  name: string;
  status: ChannelStatus;
}

// ─── Models ─────────────────────────────────────────────────────────

export interface GatewayModel {
  id: string;
  provider: string;
  model: string;
  is_default: boolean;
  is_image: boolean;
  is_fallback: boolean;
  status: 'available' | 'no_auth' | 'expired' | 'error' | string;
  /**
   * True when the provider isn't declared in `models.providers` (the
   * allow-list entry is stale, calls will fail at runtime). Computed
   * server-side by `extractModelsFromConfig`.
   */
  orphan?: boolean;
}

/**
 * Result of `GET /gateway/config-health` — audit of orphan references in
 * openclaw.json. Each list contains items whose referenced provider isn't
 * declared in `models.providers` and isn't an OpenClaw built-in via
 * `auth.profiles`.
 *
 * `agents_missing_auth` is only populated when the endpoint is called with
 * `?check_agent_auth=1` (per-agent disk reads).
 *
 * All keys are snake_case (matches backend's preSerialization plugin).
 */
export interface ConfigHealthReport {
  has_issues: boolean;
  /** Keys in `agents.defaults.models` whose provider doesn't exist. */
  orphan_allowed_models: string[];
  /** Agents whose assigned `model` references a missing provider. */
  orphan_agent_models: Array<{
    agent_id: string;  // OpenClaw id format: <prefix>--<name>
    model: string;
  }>;
  /** Default `primary` model if its provider is missing. */
  orphan_primary: string | null;
  /** Fallback models whose provider is missing. */
  orphan_fallbacks: string[];
  /**
   * Agents whose assigned model points to a declared provider, BUT the
   * concrete OpenClaw agent lacks usable provider auth (API key, OAuth,
   * device-code, CLI or token). Spawn-time failure: missing provider auth.
   * Undefined when the endpoint was called without `?check_agent_auth=1`.
   */
  agents_missing_auth?: Array<{
    agent_id: string;
    model: string;
    provider: string;
  }>;
  generated_at: string;
}

/**
 * Result of one fix applied by `POST /gateway/config-health/auto-fix`. The
 * endpoint returns an array of these plus a `remaining_issues` report.
 */
export interface AutoFixApplied {
  type: 'primary' | 'fallback' | 'allowed_model' | 'agent_model' | 'agent_auth';
  target: string;
  before: string | null;
  after: string | null;
  auth_propagation?: {
    propagated: boolean;
    source: string | null;
    reason: 'already_present' | 'no_donor' | 'propagated' | 'unknown_provider';
  };
}

// ─── Sandbox image (Docker autobuild) ──────────────────────────────

/**
 * Docker availability as detected by Core via /var/run/docker.sock.
 * Distinct kinds let the UI show specific actionable messages.
 */
export type SandboxDockerAvailability =
  | { kind: 'available'; api_version?: string }
  | { kind: 'socket_missing' }
  | { kind: 'daemon_down'; detail?: string }
  | { kind: 'permission_denied'; detail?: string };

/**
 * Result of `GET /gateway/sandbox/image-status`. The dash uses this to
 * decide which UI state to show in Settings → Sandbox (ready/missing/etc).
 */
export interface SandboxImageStatus {
  docker: SandboxDockerAvailability;
  image_exists: boolean;
  image_size_bytes?: number;
  image_id?: string;
  last_built_at?: string;
}

export interface AutoFixResult {
  fixes_applied: AutoFixApplied[];
  remaining_issues: ConfigHealthReport;
}

/** Capacidades del catálogo CURADO (core/data/model-catalog). */
export interface CuratedCaps {
  reasoning: boolean;
  vision: boolean;
  tools: boolean;
}

export interface CatalogModel {
  key: string;
  name: string;
  provider: string;
  context_window: number | null;
  input_type: string;
  available: boolean;
  configured: boolean;
  is_default: boolean;
  local: boolean;
  size_bytes?: number | null; // Ollama: tamaño en disco (badge "espacio en disco")
  // ── Metadata del catálogo CURADO — presentes SOLO con match ──
  /** Contexto máximo DEL MODELO (el chip muestra el asignado si existe; este va al tooltip). */
  max_context?: number | null;
  max_output?: number | null;
  caps?: CuratedCaps | null;
  /** Knowledge cutoff ("2025-04") → tooltip del chip de contexto. */
  knowledge?: string | null;
  /** Slug VERIFICADO de artificialanalysis.ai/models/<slug>; null/ausente = sin botón. */
  aa_slug?: string | null;
}

// ─── Model health test (POST /gateway/models/test) ─────────────────
// "Available" en una fila de modelo = respondió a un TEST real (completion
// de 1 token), no "hay credencial". Los resultados viven en Core hasta su
// reinicio y se rehidratan con GET /gateway/models/tests.

export interface ModelTestResult {
  ok: boolean;
  tag: 'available' | 'present' | 'auth' | 'rate_limit' | 'not_found' | 'not_serving' | 'unreachable' | 'error';
  phase: string;
  upstream_status?: number;
  message?: string;
  latency_ms?: number;
  /** Solo en not_found: tamaño y muestra del catálogo real del provider. */
  available_count?: number;
  available_sample?: string[];
  /** Cap de tokens/min declarado por el provider en sus headers de rate-limit.
   *  Por debajo de un turno real de agente (~40-70k) → pill ámbar "Limited". */
  limit_tokens_per_minute?: number;
  tested_at: string;
}

// ─── Providers overview (SSOT de auth por proveedor) ───────────────
// `GET /gateway/models/providers-overview` — la vista reconciliada de la que
// derivan TODAS las superficies del módulo Models (tarjetas del Catalog,
// vista de modelos, Configured, Provider Status). `has_credential` es LA
// señal de auth (punto verde, gates de +Add, entrar a modelos). El flag
// `catalog.available` NO es auth: significa "modelo destacado".

export interface ProviderOverview {
  id: string;
  /** Existe `models.providers[id]` en openclaw.json. */
  entry_in_config: boolean;
  /** Credencial USABLE en runtime — la señal de auth para todo el módulo. */
  has_credential: boolean;
  credential_source: 'api_key' | 'local_marker' | 'auth_store' | null;
  /** Mirror declarado en config SIN secreto detrás → ofrecer "Clean up". */
  declared_only: boolean;
  /** Key huérfana rescatable (pre-migración 2026.6.11) → ofrecer "Rescue key". */
  orphan_credentials: boolean;
  /** Modelos destacados en el catálogo. null si el catálogo está frío. */
  featured_count: number | null;
  configured_count: number;
  is_user_managed: boolean;
  base_url: string | null;
}

export interface ProvidersOverviewResponse {
  providers: ProviderOverview[];
  catalog_warm: boolean;
}

// ─── Unified OpenClaw provider/model catalog ──────────────────────

export interface ProviderAuthMethod {
  id: string;
  label: string;
  hint: string | null;
  kind: 'api_key' | 'oauth' | 'device_code' | 'token' | string;
}

export interface CatalogProvider {
  id: string;
  label: string;
  description: string;
  installed: true;
  enabled: boolean;
  source: 'openclaw_plugin' | 'openclaw_catalog' | 'micelclaw_config' | string;
  plugin_id: string | null;
  version: string | null;
  docs_path: string | null;
  auth_methods: ProviderAuthMethod[];
  api_transport: string | null;
  model_count: number;
  configured_count: number;
  has_credential: boolean;
  credential_source: ProviderOverview['credential_source'];
  entry_in_config: boolean;
  is_user_managed: boolean;
  is_cli_backend: boolean;
  legacy_configured: boolean;
  migration_target: string | null;
  status: 'configured' | 'not_configured';
}

export interface InstallableCatalogProvider {
  id: string;
  label: string;
  description: string;
  installed: false;
  enabled: false;
  source: 'openclaw_official';
  plugin_id: string;
  docs_path: string | null;
  categories: string[];
  auth_methods: ProviderAuthMethod[];
  install_ref: string;
  model_count: 0;
  configured_count: 0;
  has_credential: false;
  status: 'available_to_install';
}

export interface UnifiedModelCatalog {
  count: number;
  models: CatalogModel[];
  providers: CatalogProvider[];
  available_providers: InstallableCatalogProvider[];
  source: 'openclaw';
  openclaw_version: string | null;
  degraded: boolean;
  generated_at: string;
}

export type ProviderAuthFlowStatus = 'running' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';

export interface ProviderAuthFlowMessage {
  id: string;
  type: 'intro' | 'outro' | 'note' | 'plain' | 'progress' | 'progress_done' | 'open_url';
  message: string;
  title: string | null;
}

export interface ProviderAuthFlowPrompt {
  id: string;
  type: 'text' | 'select' | 'multiselect' | 'confirm';
  message: string;
  sensitive: boolean;
  options: Array<{ value: unknown; label: string; hint: string | null }>;
  initial_value?: unknown;
}

export interface ProviderAuthFlow {
  id: string;
  provider: string;
  method: string;
  status: ProviderAuthFlowStatus;
  messages: ProviderAuthFlowMessage[];
  prompt: ProviderAuthFlowPrompt | null;
  result: { provider_id?: string; method_id?: string; default_model?: string } | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

// ─── Models: status (CLI: openclaw models status --json) ────────────

export interface ModelsStatus {
  configPath: string;
  agentDir: string;
  defaultModel: string | null;
  resolvedDefault: string | null;
  fallbacks: string[];
  imageModel: string | null;
  imageFallbacks: string[];
  aliases: Record<string, string>;
  allowed: string[];
  auth: {
    storePath: string;
    providersWithOAuth: string[];
    missingProvidersInUse: string[];
    providers: Array<{
      provider: string;
      effective: { kind: string; detail: string };
      /** Fila sintética de mirror `auth.profiles` sin material secreto
       *  (`effective.kind === 'declared'`) → "Declared in config — no
       *  credential" con acción "Clean up" en la UI. */
      declared_only?: boolean;
      profiles: {
        count: number;
        oauth: number;
        token: number;
        apiKey: number;
        labels: string[];
      };
    }>;
  };
}

// ─── Auth profiles (credentials per provider) ──────────────────────

export interface AuthProfileEntry {
  profile_id: string;
  provider: string;
  type: string;
  token_masked: string;
  expires?: number;
}

// ─── Sessions ───────────────────────────────────────────────────────

export interface GatewaySession {
  id: string;
  key: string;
  agent: string;
  kind: string;
  model: string;
  tokens_used: number;
  input_tokens: number;
  output_tokens: number;
  context_tokens: number;
  percent_used?: number;
  updated_at: string | null;
  age_ms: number;
}

// ─── Cron ───────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  action_type: 'message' | 'system_event' | string;
  action_payload: string;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
}

export interface CronRun {
  id: string;
  job_id: string;
  status: 'success' | 'failure';
  started_at: string;
  completed_at: string;
  output?: string;
}

// ─── Usage ──────────────────────────────────────────────────────────

export interface GatewayUsage {
  total_messages: number;
  total_tokens: number;
  total_cost_usd: number;
  by_provider: Array<{ provider: string; tokens: number; cost_usd: number }>;
  by_channel: Array<{ channel: string; messages: number }>;
}

// ─── Logs ───────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace' | string;
  message: string;
  source?: string;
}

// ─── Tabs ───────────────────────────────────────────────────────────

export type GatewayTab = 'overview' | 'channels' | 'models' | 'sessions' | 'cron' | 'logs' | 'devices' | 'heartbeat';

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

// ─── Gateway API service — wraps /api/v1/gateway/* endpoints ────────

import { api } from './api';
import type {
  GatewayStatus,
  GatewayHealth,
  GatewayChannel,
  GatewayModel,
  GatewaySession,
  GatewayUsage,
  CatalogModel,
  ConfigHealthReport,
  AutoFixResult,
  SandboxImageStatus,
  CronJob,
  CronRun,
  LogEntry,
  ModelsStatus,
  AuthProfileEntry,
} from '@/modules/gateway/types';

// ─── Snapshot (single request for all data) ─────────────────────────

export interface GatewaySnapshot {
  status: GatewayStatus;
  health: GatewayHealth;
  channels: { channels: GatewayChannel[]; auth_providers: unknown[] };
  models: { models: GatewayModel[]; default_model?: string; fallbacks?: string[]; aliases?: Record<string, string> };
  sessions: { count: number; sessions: GatewaySession[] };
  configured?: boolean | null;
  _runtime_ready?: boolean;
}

export async function getSnapshot(): Promise<GatewaySnapshot> {
  const res = await api.get<{ data: GatewaySnapshot }>('/gateway/snapshot');
  return res.data;
}

// ─── Context usage (para el anillo de % en la toolbar del chat) ─────
// Wrappea `sessions.describe` server-side (user-scoped, endpoint en
// /conversations/threads/:id/context porque /gateway/* es admin-only).
// `window`/`pct` null = sin sesión todavía o el describe falló → anillo oculto.
export interface SessionContext {
  used: number;
  window: number | null;
  pct: number | null;
}

export async function getConversationContext(conversationId: string): Promise<SessionContext> {
  const res = await api.get<{ data: SessionContext }>(
    `/conversations/threads/${encodeURIComponent(conversationId)}/context`,
  );
  return res.data;
}

// ─── Status & Health ────────────────────────────────────────────────

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const res = await api.get<{ data: GatewayStatus }>('/gateway/status');
  return res.data;
}

export async function getGatewayHealth(): Promise<GatewayHealth> {
  const res = await api.get<{ data: GatewayHealth }>('/gateway/health');
  return res.data;
}

// ─── Actions ────────────────────────────────────────────────────────

export async function startGateway(): Promise<void> {
  await api.post('/gateway/start');
}

export async function stopGateway(): Promise<void> {
  await api.post('/gateway/stop');
}

export async function restartGateway(): Promise<void> {
  await api.post('/gateway/restart');
}

// ─── Channels ───────────────────────────────────────────────────────

export async function getChannels(): Promise<GatewayChannel[]> {
  const res = await api.get<{ data: { channels: GatewayChannel[] } | GatewayChannel[] }>('/gateway/channels');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'channels' in d) return (d as { channels: GatewayChannel[] }).channels;
  return [];
}

export async function addChannel(params: {
  channel: string;
  account?: string;
  name?: string;
  token?: string;
}): Promise<unknown> {
  const res = await api.post<{ data: unknown }>('/gateway/channels', params);
  return res.data;
}

export async function removeChannel(
  type: string,
  account?: string,
  deleteCreds = false,
): Promise<void> {
  const params: Record<string, string> = {};
  if (account) params.account = account;
  if (deleteCreds) params.delete = 'true';
  await api.delete(`/gateway/channels/${type}`, params);
}

export async function loginChannel(type: string, account?: string): Promise<unknown> {
  const params: Record<string, string> = {};
  if (account) params.account = account;
  const res = await api.post<{ data: unknown }>(
    `/gateway/channels/${type}/login`,
    undefined,
    { timeout: 60_000 },
  );
  return res.data;
}

export async function logoutChannel(type: string, _account?: string): Promise<void> {
  await api.post(`/gateway/channels/${type}/logout`);
}

// ─── Channel Config ────────────────────────────────────────────────

export async function getChannelConfig(type: string): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: { type: string; config: Record<string, unknown> } }>(
    `/gateway/channels/${type}/config`,
  );
  return res.data.config;
}

export async function updateChannelConfig(
  type: string,
  config: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/gateway/channels/${type}/config`, config);
}

// ─── Messages Config (queue, streaming, TTS, reactions) ────────────

export interface MessagesConfig {
  queue: Record<string, unknown>;
  inbound: Record<string, unknown>;
  status_reactions: Record<string, unknown>;
  ack_reaction: string | null;
  ack_reaction_scope: string;
  tts: Record<string, unknown>;
  streaming: Record<string, unknown>;
  // F3.4: messages.groupChat (OpenClaw 5.17+). Either field may be
  // absent — the binary falls back to defaults user_request / automatic.
  group_chat?: {
    unmentioned_inbound?: 'user_request' | 'room_event';
    visible_replies?: 'automatic' | 'message_tool';
  };
}

export async function getMessagesConfig(): Promise<MessagesConfig> {
  const res = await api.get<{ data: MessagesConfig }>('/gateway/messages-config');
  return res.data;
}

export async function updateMessagesConfig(
  config: Partial<MessagesConfig>,
): Promise<void> {
  await api.patch('/gateway/messages-config', config);
}

// ─── Models ─────────────────────────────────────────────────────────

export async function getModels(): Promise<GatewayModel[]> {
  const res = await api.get<{ data: GatewayModel[] | { models: GatewayModel[] } }>('/gateway/models');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'models' in d) return (d as { models: GatewayModel[] }).models;
  return [];
}

export async function setDefaultModel(model: string): Promise<void> {
  await api.post('/gateway/models/default', { model });
}

/**
 * Audit orphan references in openclaw.json. Pass `checkAgentAuth: true`
 * to also read per-agent `auth-profiles.json` files and surface agents
 * whose assigned model's provider isn't authed at the agent level (the
 * Gateway will fail spawn with "No API key found for provider X").
 */
export async function getConfigHealth(opts?: { checkAgentAuth?: boolean }): Promise<ConfigHealthReport> {
  const res = await api.get<{ data: ConfigHealthReport }>(
    '/gateway/config-health',
    opts?.checkAgentAuth ? { check_agent_auth: '1' } : undefined,
  );
  return res.data;
}

/**
 * Single-shot saneo for orphan references in openclaw.json. The backend
 * reassigns user-scoped orphan agents to the default primary (saneado), prunes
 * orphan fallbacks, unsets orphan allow-list keys, swaps a broken primary, and
 * propagates auth profiles from a donor. Returns a per-fix breakdown plus the
 * `remaining_issues` audit (non-empty when something couldn't be auto-resolved,
 * typically because the system has zero valid models left).
 */
export async function autoFixConfigHealth(): Promise<AutoFixResult> {
  const res = await api.post<{ data: AutoFixResult }>('/gateway/config-health/auto-fix', {});
  return res.data;
}

/**
 * Check whether the Docker sandbox image (`openclaw-sandbox:bookworm-slim`)
 * is built on the host. Also reports Docker availability so the UI can show
 * specific errors (socket missing / daemon down / permission denied).
 */
export async function getSandboxImageStatus(): Promise<SandboxImageStatus> {
  const res = await api.get<{ data: SandboxImageStatus }>('/gateway/sandbox/image-status');
  return res.data;
}

/**
 * Trigger an async build of the sandbox image. Returns immediately with a
 * build_id; progress streams over WebSocket as `service.starting/logs/ready/
 * failed` events with `service: 'sandbox-image'`. Backend returns 409 if a
 * build is already in progress.
 */
export async function buildSandboxImage(): Promise<{ ok: boolean; build_id: string }> {
  const res = await api.post<{ data: { ok: boolean; build_id: string } }>('/gateway/sandbox/build-image', {});
  return res.data;
}

export async function getModelCatalog(): Promise<{ count: number; models: CatalogModel[] }> {
  // 45s timeout: the underlying CLI call (`openclaw models list --all --json`)
  // takes ~20s for a full catalog on a cold Core. Core pre-warms in boot, so
  // most user-visible calls hit the 5min cache and return in <50ms. The 45s
  // ceiling is a safety net for the very first request after boot or after
  // mutation-driven cache invalidations.
  const res = await api.get<{ data: { count: number; models: CatalogModel[] } }>('/gateway/models/catalog', undefined, { timeout: 45_000 });
  const d = res.data;
  if (d && typeof d === 'object' && 'models' in d) return d as { count: number; models: CatalogModel[] };
  return { count: 0, models: [] };
}

export async function addModel(model: string): Promise<void> {
  await api.post('/gateway/models/add', { model });
}

// Add model + register it in models.providers[id].models[] in a single
// configPatch (saves 1 write of the 3-per-60s rate limit). Used for
// discovered models from custom providers (LM Studio, vLLM, etc.).
//
// The backend probes the provider's catalog (`GET /v1/models`) to verify
// the model id exists. Fast (~1s) and authoritative — no cold-start cost.
// If the model is not in the catalog, the backend returns
// `MODEL_NOT_IN_CATALOG` with a sample of available ids.
export async function addModelWithConfig(params: {
  model: string;
  provider_id: string;
  model_id: string;
  name?: string;
  max_tokens?: number;
  context_window?: number;
  input?: string[];
}): Promise<void> {
  // Backend probe is 2-phase: catalog (8s) + service ping (15s). 25s da margen
  // por encima del peor caso (23s) para que el cliente reciba el error code real
  // (MODEL_NOT_SERVING) en lugar de abortarse con un "signal timed out" genérico.
  await api.post('/gateway/models/add-with-config', params, { timeout: 25_000 });
}

export async function removeModel(model: string): Promise<void> {
  await api.post('/gateway/models/remove', { model });
}

// Hard delete de un modelo local de Ollama (borra el blob de disco). `id` = tag
// real de Ollama (p.ej. 'qwen3:14b' o 'hf.co/org/repo:latest'). Para desregistrarlo
// como modelo de chat, llamar también a removeModel('ollama/<id>') (best-effort).
export async function deleteOllamaModel(id: string): Promise<void> {
  await api.post('/gateway/models/ollama-delete', { id });
}

// Metadatos de un modelo Ollama (de /api/show + /api/tags + nvidia-smi) para
// estimar VRAM/RAM en el panel de ajustes por-modelo.
export interface OllamaModelInfo {
  id: string;
  arch: string;
  size_bytes: number | null;
  block_count: number | null;
  head_count_kv: number | null;
  key_length: number | null;
  value_length: number | null;
  full_attention_interval: number | null; // híbridos SSM (qwen35): KV solo en 1 de cada N capas
  // Modelo KV calculado en el backend (arch-aware: dense / SSM / sliding-window
  // tipo gemma con head_count_kv por-capa). El dash combina:
  //   kv_bytes = kv_grow_bytes_per_token × num_ctx + kv_fixed_bytes
  kv_grow_bytes_per_token: number | null; // KV que crece con el contexto (capas full-attention)
  kv_fixed_bytes: number | null;          // KV fijo (capas sliding-window, topadas en sliding_window)
  context_length_max: number | null;
  quantization: string | null;
  vram_total_mb: number | null;
  ram_total_mb: number | null;
  ram_available_mb: number | null;
}

// Params de tuning editables por-modelo Ollama (van a models.providers.ollama.models[].params).
export interface OllamaTuningParams {
  num_ctx?: number | null;
  num_gpu?: number | null;
  num_batch?: number | null;
  num_thread?: number | null;
  keep_alive?: string | number | null;
}

export async function getOllamaModelInfo(id: string): Promise<OllamaModelInfo> {
  const res = await api.get<{ data: OllamaModelInfo }>('/gateway/models/ollama-info', { id });
  return res.data;
}

export async function updateOllamaParams(id: string, params: OllamaTuningParams): Promise<void> {
  await api.patch('/gateway/models/ollama-params', { id, params });
}

// ─── Árbitro de VRAM (Fase 2) ──────────────────────────────────────
export interface GpuModelOverride { pinned?: boolean; force_cpu?: boolean }
export interface GpuCoordConfig {
  enabled: boolean;
  priority: 'chat' | 'multimodal';
  idle_window_min: number;
  pinned_model: string | null;
  pause_photos_while_chat: boolean;
  paused: boolean;
  model_overrides: Record<string, GpuModelOverride>;
  embed_num_gpu: number | null;
}
export type GpuRole = 'chat' | 'embed' | 'extract' | 'multimodal' | 'vision' | 'other';
export type GpuModelStatus = 'loaded' | 'idle';
export interface GpuLoadedModel { name: string; role: GpuRole; vram_gb: number; pinned: boolean }
export interface GpuCatalogModel { id: string; name: string; role: GpuRole; vram_gb: number; loaded: boolean; pinned: boolean; status: GpuModelStatus; external?: boolean }
export interface GpuCoordState {
  enabled: boolean;
  paused: boolean;
  vram_total_mb: number | null;
  free_vram_mb: number | null;
  used_mb: number | null;
  loaded: GpuLoadedModel[];
  onnx_loaded: string[];
  other_gb: number | null;
  chat_active: boolean;
  photos_can_proceed: boolean;
  queue: { embed: number; extract: number; total: number };
  models: GpuCatalogModel[];
}

export async function getGpuCoordination(): Promise<{ config: GpuCoordConfig; state: GpuCoordState }> {
  const res = await api.get<{ data: { config: GpuCoordConfig; state: GpuCoordState } }>('/gateway/gpu-coordination');
  return res.data;
}

export async function getGpuState(): Promise<GpuCoordState> {
  const res = await api.get<{ data: GpuCoordState }>('/gateway/gpu-coordination/state');
  return res.data;
}

export async function updateGpuCoordination(patch: Partial<GpuCoordConfig>): Promise<GpuCoordConfig> {
  const res = await api.patch<{ data: { config: GpuCoordConfig } }>('/gateway/gpu-coordination', patch);
  return res.data.config;
}

/** "Liberar VRAM": descarga TODO lo cargado (Ollama + ONNX). Devuelve el estado tras la acción. */
export async function freeGpuVram(): Promise<{ unloaded: string[]; state: GpuCoordState }> {
  const res = await api.post<{ data: { unloaded: string[]; state: GpuCoordState } }>('/gateway/gpu-coordination/free-vram', {});
  return res.data;
}

export async function setDefaultImageModel(model: string): Promise<void> {
  await api.post('/gateway/models/default-image', { model });
}

export async function getModelsStatus(probe = false): Promise<ModelsStatus> {
  const res = await api.get<{ data: ModelsStatus }>('/gateway/models/status', probe ? { probe: 'true' } : undefined);
  return res.data;
}

// ─── Aliases ────────────────────────────────────────────────────────

export async function getAliases(): Promise<Record<string, string>> {
  const res = await api.get<{ data: Record<string, string> }>('/gateway/models/aliases');
  return res.data ?? {};
}

export async function addAlias(alias: string, model: string): Promise<void> {
  await api.post('/gateway/models/aliases', { alias, model });
}

export async function removeAlias(alias: string): Promise<void> {
  await api.delete(`/gateway/models/aliases/${encodeURIComponent(alias)}`);
}

// ─── Fallbacks ──────────────────────────────────────────────────────

export async function getFallbacks(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/gateway/models/fallbacks');
  return res.data ?? [];
}

export async function addFallback(model: string): Promise<void> {
  await api.post('/gateway/models/fallbacks', { model });
}

export async function removeFallback(model: string): Promise<void> {
  await api.delete(`/gateway/models/fallbacks/${encodeURIComponent(model)}`);
}

export async function clearFallbacks(): Promise<void> {
  await api.delete('/gateway/models/fallbacks');
}

// ─── Image fallbacks ────────────────────────────────────────────────

export async function getImageFallbacks(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/gateway/models/image-fallbacks');
  return res.data ?? [];
}

export async function addImageFallback(model: string): Promise<void> {
  await api.post('/gateway/models/image-fallbacks', { model });
}

export async function removeImageFallback(model: string): Promise<void> {
  await api.delete(`/gateway/models/image-fallbacks/${encodeURIComponent(model)}`);
}

export async function clearImageFallbacks(): Promise<void> {
  await api.delete('/gateway/models/image-fallbacks');
}

// ─── Auth profiles ──────────────────────────────────────────────────

export async function getAuthProfiles(): Promise<AuthProfileEntry[]> {
  const res = await api.get<{ data: AuthProfileEntry[] }>('/gateway/models/auth/profiles');
  return res.data ?? [];
}

export async function setAuthToken(input: {
  provider: string;
  token: string;
  profile_id?: string;
  expires_in_ms?: number;
}): Promise<{ profile_id: string }> {
  const res = await api.post<{ data: { ok: boolean; profile_id: string } }>(
    '/gateway/models/auth/token',
    input,
  );
  return { profile_id: res.data.profile_id };
}

export async function removeAuthProfile(profileId: string): Promise<void> {
  await api.delete(`/gateway/models/auth/profiles/${encodeURIComponent(profileId)}`);
}

// ─── Sessions ───────────────────────────────────────────────────────

export async function getSessions(verbose = false): Promise<GatewaySession[]> {
  try {
    const res = await api.get<{ data: GatewaySession[] | { sessions: GatewaySession[] } }>(
      '/gateway/sessions',
      { verbose: verbose ? 'true' : undefined },
    );
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object' && 'sessions' in d) return (d as { sessions: GatewaySession[] }).sessions;
    return [];
  } catch {
    return [];
  }
}

// ─── Usage ──────────────────────────────────────────────────────────

export async function getUsage(): Promise<GatewayUsage> {
  const res = await api.get<{ data: GatewayUsage }>('/gateway/usage');
  return res.data;
}

// ─── Cron ───────────────────────────────────────────────────────────

export async function getCronJobs(): Promise<CronJob[]> {
  const res = await api.get<{ data: CronJob[] | { jobs: CronJob[] } }>('/gateway/cron');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'jobs' in d) return (d as { jobs: CronJob[] }).jobs;
  return [];
}

export async function addCronJob(params: {
  name: string;
  schedule: string;
  schedule_type: 'at' | 'every' | 'cron';
  action: 'system-event' | 'message';
  payload: string;
  target?: string;
  channel?: string;
}): Promise<unknown> {
  const res = await api.post<{ data: unknown }>('/gateway/cron', params);
  return res.data;
}


export async function deleteCronJob(id: string): Promise<void> {
  await api.delete(`/gateway/cron/${id}`);
}

export async function toggleCronJob(id: string, enabled: boolean): Promise<void> {
  await api.post(`/gateway/cron/${id}/toggle`, { enabled });
}

export async function runCronJob(id: string): Promise<unknown> {
  const res = await api.post<{ data: unknown }>(`/gateway/cron/${id}/run`, undefined, { timeout: 60_000 });
  return res.data;
}

export async function getCronRuns(id: string, limit = 20): Promise<CronRun[]> {
  const res = await api.get<{ data: CronRun[] | { runs: CronRun[] } }>(
    `/gateway/cron/${id}/runs`,
    { limit: String(limit) },
  );
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'runs' in d) return (d as { runs: CronRun[] }).runs;
  return [];
}

// ─── Provisioning ───────────────────────────────────────────────────

export interface ProvisionResult {
  provisioned: number;
  agents: string[];
  skipped: boolean;
  reason?: string;
}

export async function provisionAgents(): Promise<ProvisionResult> {
  const res = await api.post<{ data: ProvisionResult }>('/gateway/provision-agents');
  return res.data;
}

// ─── User Profile Sync ──────────────────────────────────────────────

export interface SyncUserProfileResult {
  synced: string[];
  skipped: string[];
  source: string;
}

export async function syncUserProfile(): Promise<SyncUserProfileResult> {
  const res = await api.post<{ data: SyncUserProfileResult }>('/gateway/sync-user-profile');
  return res.data;
}

// ─── Logs ───────────────────────────────────────────────────────────

export async function getLogs(limit = 200): Promise<LogEntry[]> {
  const res = await api.get<{ data: LogEntry[] | { entries: LogEntry[] } }>(
    '/gateway/logs',
    { limit: String(limit) },
  );
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'entries' in d) return (d as { entries: LogEntry[] }).entries;
  return [];
}

// ─── Sandbox Config ────────────────────────────────────────────────

export interface SandboxConfig {
  mode: string;
  scope: string;
  workspace_access: string;
  docker: Record<string, unknown>;
  browser: Record<string, unknown>;
  prune: { idle_hours: number; max_age_days: number };
}

export async function getSandboxConfig(): Promise<SandboxConfig> {
  const res = await api.get<{ data: SandboxConfig }>('/gateway/sandbox-config');
  return res.data;
}

export async function updateSandboxConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/sandbox-config', config);
}

// ─── Browser Config ────────────────────────────────────────────────

export interface BrowserConfig {
  enabled: boolean;
  headless: boolean;
  evaluate_enabled: boolean;
  default_profile: string;
  ssrf_policy: Record<string, unknown>;
  profiles: Record<string, Record<string, unknown>>;
  extra_args: string[];
}

export async function getBrowserConfig(): Promise<BrowserConfig> {
  const res = await api.get<{ data: BrowserConfig }>('/gateway/browser-config');
  return res.data;
}

export async function updateBrowserConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/browser-config', config);
}

// ─── Gateway Auth Config ───────────────────────────────────────────

export interface GatewayAuthConfig {
  mode: string;
  has_token: boolean;
  has_password: boolean;
  allow_tailscale: boolean;
  rate_limit: Record<string, unknown> | null;
  port: number;
  bind: string;
  tls: Record<string, unknown>;
  tailscale: Record<string, unknown>;
  reload: Record<string, unknown>;
}

export async function getAuthConfig(): Promise<GatewayAuthConfig> {
  const res = await api.get<{ data: GatewayAuthConfig }>('/gateway/auth-config');
  return res.data;
}

export async function updateAuthConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/auth-config', config);
}

// ─── Device Management ─────────────────────────────────────────────

export interface PendingDevice {
  request_id: string;
  device_id: string;
  platform: string;
  client_id: string;
  role: string;
  scopes: string[];
  created_at_ms: number;
  display_name?: string;
}

export interface PairedDevice {
  device_id: string;
  platform: string;
  client_id: string;
  client_mode: string;
  role: string;
  roles: string[];
  scopes: string[];
  approved_scopes: string[];
  display_name?: string;
  tokens: Record<string, {
    role: string;
    scopes: string[];
    created_at_ms: number;
    rotated_at_ms?: number;
    last_used_at_ms?: number;
  }>;
  created_at_ms: number;
  approved_at_ms: number;
}

export interface DevicesResponse {
  pending: PendingDevice[];
  paired: PairedDevice[];
}

export async function getDevices(): Promise<DevicesResponse> {
  const res = await api.get<{ data: DevicesResponse }>('/gateway/devices');
  return res.data;
}

export async function approveDevice(requestId: string): Promise<unknown> {
  const res = await api.post<{ data: unknown }>('/gateway/devices/approve', { requestId });
  return res.data;
}

export async function rejectDevice(requestId: string): Promise<void> {
  await api.post('/gateway/devices/reject', { requestId });
}

export async function removeDevice(deviceId: string): Promise<void> {
  await api.delete(`/gateway/devices/${deviceId}`);
}

export interface RotateTokenResult {
  device_id: string;
  role: string;
  token: string; // Actual secret — show only once!
  scopes: string[];
  created_at_ms: number;
  rotated_at_ms: number;
}

export async function rotateDeviceToken(
  deviceId: string,
  role: string,
  scopes?: string[],
): Promise<RotateTokenResult> {
  const res = await api.post<{ data: RotateTokenResult }>(
    `/gateway/devices/${deviceId}/rotate`,
    { role, ...(scopes ? { scopes } : {}) },
  );
  return res.data;
}

export async function revokeDeviceToken(deviceId: string, role: string): Promise<void> {
  await api.post(`/gateway/devices/${deviceId}/revoke`, { role });
}

// ─── Approvals Forwarding Config ───────────────────────────────────

export interface ApprovalsConfig {
  enabled: boolean;
  mode: string;
  agent_filter: string[] | null;
  session_filter: string[] | null;
  targets: Array<{ channel: string; to: string; account_id?: string }>;
}

export async function getApprovalsConfig(): Promise<ApprovalsConfig> {
  const res = await api.get<{ data: ApprovalsConfig }>('/gateway/approvals-config');
  return res.data;
}

export async function updateApprovalsConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/approvals-config', config);
}

// ─── Memory Config ─────────────────────────────────────────────────

export async function getMemoryConfig(): Promise<{
  memory_search: Record<string, unknown>;
  memory: Record<string, unknown>;
  memory_lancedb?: Record<string, unknown>;
}> {
  const res = await api.get<{ data: { memory_search: Record<string, unknown>; memory: Record<string, unknown>; memory_lancedb?: Record<string, unknown> } }>('/gateway/memory-config');
  return res.data;
}

export async function updateMemoryConfig(config: {
  memorySearch?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  memoryLancedb?: Record<string, unknown>;
}): Promise<void> {
  await api.patch('/gateway/memory-config', config);
}

// ─── G7: LanceDB S3-compatible storage ─────────────────────────────

export interface LanceDbS3TestResult {
  ok: boolean;
  bucket_name?: string;
  region?: string;
  object_count?: number;
  error?: string;
}

export interface LanceDbS3InitResult {
  ok: boolean;
  created?: boolean;
  warning?: string;
  error?: string;
}

export async function testLanceDbConnection(body: { dbPath: string; storageOptions: Record<string, string> }): Promise<LanceDbS3TestResult> {
  const res = await api.post<{ data: LanceDbS3TestResult }>('/gateway/memory/lancedb-test', body);
  return res.data;
}

export async function initLanceDbBucket(body: { dbPath: string; storageOptions: Record<string, string> }): Promise<LanceDbS3InitResult> {
  const res = await api.post<{ data: LanceDbS3InitResult }>('/gateway/memory/lancedb-init', body);
  return res.data;
}

// ─── Active Memory Config ──────────────────────────────────────────

export async function getActiveMemoryConfig(): Promise<{ plugin_enabled: boolean; config: Record<string, unknown> }> {
  const res = await api.get<{ data: { plugin_enabled: boolean; config: Record<string, unknown> } }>('/gateway/active-memory-config');
  return res.data;
}

export async function updateActiveMemoryConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/active-memory-config', { config });
}

export async function enableActiveMemoryPlugin(): Promise<void> {
  await api.post('/gateway/plugins/active-memory/enable', {});
}

// ─── Session Config ────────────────────────────────────────────────

export async function getSessionConfig(): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: Record<string, unknown> }>('/gateway/session-config');
  return res.data;
}

export async function updateSessionConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/session-config', config);
}

// ─── Cron Config (advanced) ────────────────────────────────────────

export async function getCronConfig(): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: Record<string, unknown> }>('/gateway/cron-config');
  return res.data;
}

export async function updateCronConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/cron-config', config);
}

// ─── Hooks Config ──────────────────────────────────────────────────

export async function getHooksConfig(): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: Record<string, unknown> }>('/gateway/hooks-config');
  return res.data;
}

export async function updateHooksConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/hooks-config', config);
}

export interface AvailableHook {
  id: string;
  name: string;
  description: string;
}

export async function getAvailableHooks(): Promise<AvailableHook[]> {
  const res = await api.get<{ data: AvailableHook[] }>('/gateway/hooks-config/available-hooks');
  return res.data ?? [];
}

// ─── Heartbeat Config ──────────────────────────────────────────────

export interface HeartbeatConfig {
  global: Record<string, unknown>;
  per_agent: Record<string, Record<string, unknown>>;
}

export async function getHeartbeatConfig(): Promise<HeartbeatConfig> {
  const res = await api.get<{ data: HeartbeatConfig }>('/gateway/heartbeat-config');
  return res.data;
}

export async function updateHeartbeatConfig(config: {
  global?: Record<string, unknown>;
  agentId?: string;
  agentHeartbeat?: Record<string, unknown>;
}): Promise<void> {
  await api.patch('/gateway/heartbeat-config', config);
}

// ─── Bundled Skills ────────────────────────────────────────────────

export interface BundledSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: string;
  enabled: boolean;
  has_api_key: boolean;
  has_env: boolean;
}

export async function getBundledSkills(): Promise<BundledSkill[]> {
  const res = await api.get<{ data: BundledSkill[] }>('/gateway/bundled-skills');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getSkillsConfig(): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: Record<string, unknown> }>('/gateway/skills-config');
  return res.data;
}

export async function updateSkillsConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/skills-config', config);
}

// ─── Model Providers Config ────────────────────────────────────────

export interface ProvidersConfig {
  mode: string;
  providers: Record<string, Record<string, unknown>>;
  auth: {
    profiles: Record<string, unknown>;
    order: Record<string, unknown>;
    cooldowns: Record<string, unknown>;
  };
}

export async function getProvidersConfig(): Promise<ProvidersConfig> {
  const res = await api.get<{ data: ProvidersConfig }>('/gateway/providers-config');
  return res.data;
}

export async function updateProvidersConfig(config: { models?: Record<string, unknown>; auth?: Record<string, unknown> }): Promise<void> {
  await api.patch('/gateway/providers-config', config);
}

// ─── Custom Provider: Discover + Delete ───────────────────────────

export interface DiscoveredModel {
  id: string;
  name: string;
  input: string[];
  size_bytes?: number | null; // Ollama: tamaño en disco (de /api/tags)
}

export interface DiscoverResult {
  provider: string;
  base_url: string;
  models: DiscoveredModel[];
}

export async function discoverProviderModels(providerId: string): Promise<DiscoverResult> {
  const res = await api.get<{ data: DiscoverResult }>(`/gateway/providers/${encodeURIComponent(providerId)}/discover`);
  return res.data;
}

export async function deleteProvider(providerId: string): Promise<void> {
  await api.delete(`/gateway/providers/${encodeURIComponent(providerId)}`);
}

// ─── Commands Config ───────────────────────────────────────────────

export async function getCommandsConfig(): Promise<Record<string, unknown>> {
  const res = await api.get<{ data: Record<string, unknown> }>('/gateway/commands-config');
  return res.data;
}

export async function updateCommandsConfig(config: Record<string, unknown>): Promise<void> {
  await api.patch('/gateway/commands-config', config);
}

// ─── Raw Config Editor (Ola 7, oc7-7) — admin-only ────────────────

export interface RawConfigResponse {
  content: string;
  hash: string;
  path: string;
}

export interface RawConfigBackup {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

export async function getRawConfig(): Promise<RawConfigResponse> {
  const res = await api.get<{ data: RawConfigResponse }>('/gateway/raw-config');
  return res.data;
}

export async function saveRawConfig(content: string, hash: string): Promise<{ ok: boolean; new_hash: string; backup: string }> {
  const res = await api.put<{ data: { ok: boolean; new_hash: string; backup: string } }>('/gateway/raw-config', { content, hash });
  return res.data;
}

export async function listRawConfigBackups(): Promise<RawConfigBackup[]> {
  const res = await api.get<{ data: RawConfigBackup[] }>('/gateway/raw-config/backups');
  return res.data;
}

// ─── Secrets Config (Ola 7, oc7-6.2) — admin-only ──────────────────

export interface EnvProvider {
  source: 'env';
  allowlist?: string[];
}

export interface FileProvider {
  source: 'file';
  path: string;
  mode?: 'singleValue' | 'json';
  timeout_ms?: number;
  max_bytes?: number;
}

export interface ExecProvider {
  source: 'exec';
  command: string;
  args?: string[];
  timeout_ms?: number;
  max_output_bytes?: number;
  json_only?: boolean;
  env?: Record<string, string>;
  trusted_dirs?: string[];
  allow_insecure_path?: boolean;
  allow_symlink_command?: boolean;
}

export type SecretProvider = EnvProvider | FileProvider | ExecProvider;

export interface SecretsConfig {
  providers?: Record<string, SecretProvider>;
  defaults?: {
    env?: string;
    file?: string;
    exec?: string;
  };
}

export interface SecretsTestResult {
  ok: boolean;
  length?: number;
  error?: string;
  duration_ms: number;
}

export async function getSecretsConfig(): Promise<SecretsConfig> {
  const res = await api.get<{ data: SecretsConfig }>('/gateway/secrets-config');
  return res.data;
}

export async function updateSecretsConfig(config: SecretsConfig): Promise<void> {
  await api.patch<{ data: { ok: boolean } }>('/gateway/secrets-config', config);
}

export async function testSecretProvider(provider: string, id: string): Promise<SecretsTestResult> {
  const res = await api.post<{ data: SecretsTestResult }>('/gateway/secrets/test', { provider, id });
  return res.data;
}

// ─── Environment Config (Ola 7) ────────────────────────────────────

export interface EnvConfig {
  shell_env?: {
    enabled?: boolean;
    timeout_ms?: number;
  };
  vars?: Record<string, string>;
}

export async function getEnvConfig(): Promise<EnvConfig> {
  const res = await api.get<{ data: EnvConfig }>('/gateway/env-config');
  return res.data;
}

export async function updateEnvConfig(config: EnvConfig): Promise<void> {
  await api.patch('/gateway/env-config', config);
}

// ─── Canvas Host Config (Ola 7) ────────────────────────────────────

export interface CanvasHostConfig {
  enabled?: boolean;
  root?: string;
  port?: number;
  live_reload?: boolean;
}

export async function getCanvasConfig(): Promise<CanvasHostConfig> {
  const res = await api.get<{ data: CanvasHostConfig }>('/gateway/canvas-config');
  return res.data;
}

export async function updateCanvasConfig(config: CanvasHostConfig): Promise<void> {
  await api.patch('/gateway/canvas-config', config);
}

// ─── Discovery Config (Ola 7) ──────────────────────────────────────

export interface DiscoveryConfig {
  mdns?: {
    mode?: 'off' | 'minimal' | 'full';
  };
  wide_area?: {
    enabled?: boolean;
    domain?: string;
  };
}

export async function getDiscoveryConfig(): Promise<DiscoveryConfig> {
  const res = await api.get<{ data: DiscoveryConfig }>('/gateway/discovery-config');
  return res.data;
}

export async function updateDiscoveryConfig(config: DiscoveryConfig): Promise<void> {
  await api.patch('/gateway/discovery-config', config);
}

// ─── UI Branding Config (Ola 7) ────────────────────────────────────

export interface UiConfig {
  seam_color?: string;
  assistant?: {
    name?: string;
    avatar?: string;
  };
}

export async function getUiConfig(): Promise<UiConfig> {
  const res = await api.get<{ data: UiConfig }>('/gateway/ui-config');
  return res.data;
}

export async function updateUiConfig(config: UiConfig): Promise<void> {
  await api.patch('/gateway/ui-config', config);
}

// ─── Telemetry / OTel Config (Ola 7) ───────────────────────────────

export interface OtelConfig {
  enabled?: boolean;
  endpoint?: string;
  protocol?: string;
  headers?: Record<string, string>;
  service_name?: string;
  traces?: boolean;
  metrics?: boolean;
  logs?: boolean;
  sample_rate?: number;
  flush_interval_ms?: number;
}

export interface TelemetryConfigResponse {
  otel: OtelConfig;
  plugin_enabled: boolean;
}

export async function getTelemetryConfig(): Promise<TelemetryConfigResponse> {
  const res = await api.get<{ data: TelemetryConfigResponse }>('/gateway/telemetry-config');
  return res.data;
}

export async function updateTelemetryConfig(config: OtelConfig): Promise<void> {
  await api.patch('/gateway/telemetry-config', config);
}

export async function enableDiagnosticsOtelPlugin(): Promise<void> {
  await api.post('/gateway/plugins/diagnostics-otel/enable', {});
}

// ─── Logging Config (Ola 7) ────────────────────────────────────────

export interface LoggingConfig {
  level?: string;
  console_level?: string;
  console_style?: string;
  file?: string;
  max_file_bytes?: number;
  redact_sensitive?: string;
  redact_patterns?: string[];
}

export async function getLoggingConfig(): Promise<LoggingConfig> {
  const res = await api.get<{ data: LoggingConfig }>('/gateway/logging-config');
  return res.data;
}

export async function updateLoggingConfig(config: LoggingConfig): Promise<void> {
  await api.patch('/gateway/logging-config', config);
}

// ─── Skills Status (single source for all apps) ───────────────────

export interface SkillStatus {
  name: string;
  description: string;
  source: string;
  emoji: string;
  eligible: boolean;
  disabled: boolean;
  always: boolean;
  skill_key: string;
  requirements: {
    bins: string[];
    any_bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    any_bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  install: Array<{ id: string; kind: string; label: string; bins: string[] }>;
}

export async function getSkillsStatus(): Promise<SkillStatus[]> {
  const res = await api.get<{ data: SkillStatus[] }>('/gateway/skills-status');
  return Array.isArray(res.data) ? res.data : [];
}

export async function installAppDeps(
  skillId: string,
  installId?: string,
): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  const res = await api.post<{ data: { ok: boolean; message: string; skipped?: boolean } }>(
    `/gateway/install-app-deps/${skillId}`,
    { installId },
    { timeout: 310000 }, // 5 min + 10s buffer
  );
  return res.data;
}

export async function updateSkillConfig(
  skillKey: string,
  config: { enabled?: boolean; apiKey?: string },
): Promise<void> {
  await api.post('/gateway/skills-update', { skillKey, ...config });
}

// ─── G8: compaction checkpoints ─────────────────────────────────────

export interface Checkpoint {
  id: string;
  ts?: string;
  trigger?: string;
  tokens_before?: number;
  tokens_after?: number;
  model?: string;
  summary_excerpt?: string;
}

export async function listConversationCheckpoints(conversationId: string): Promise<Checkpoint[]> {
  const res = await api.get<{ data: { checkpoints: Checkpoint[] } }>(
    `/conversations/threads/${conversationId}/checkpoints`,
  );
  return res.data.checkpoints ?? [];
}

export async function branchFromCheckpoint(conversationId: string, checkpointId: string): Promise<{
  new_conversation_id: string;
  new_session_key?: string;
  checkpoint_id: string;
}> {
  const res = await api.post<{ data: { new_conversation_id: string; new_session_key?: string; checkpoint_id: string } }>(
    `/conversations/threads/${conversationId}/checkpoints/${checkpointId}/branch`,
    {},
  );
  return res.data;
}

export async function restoreToCheckpoint(conversationId: string, checkpointId: string): Promise<{
  restored_to_ts: string | null;
  checkpoint_id: string;
}> {
  const res = await api.post<{ data: { restored_to_ts: string | null; checkpoint_id: string } }>(
    `/conversations/threads/${conversationId}/checkpoints/${checkpointId}/restore`,
    {},
  );
  return res.data;
}

// ─── Provider usage / quota (F3.1) ──────────────────────────────────
// Wraps GET /gateway/usage-status which calls the OpenClaw 5.17+
// `usage.status` RPC. Upstream tracks quota for subscription/OAuth
// providers (Claude Pro, GitHub Copilot, Gemini CLI, MiniMax, OpenAI
// Codex, Xiaomi, Z.AI). Raw-API-key providers don't have a public
// quota endpoint and never appear in `providers`.

export interface UsageWindow {
  label?: string;       // human label ("Today", "This week", ...)
  used?: number;
  limit?: number;
  remaining?: number;
  unit?: string;        // "tokens" | "requests" | "credits" | ...
  resets_at?: string;   // ISO
  // upstream sometimes nests extra fields here; we pass through raw
  [key: string]: unknown;
}

export interface ProviderUsage {
  provider: string;       // 'anthropic', 'openai-codex', 'google-gemini-cli', ...
  display_name: string;
  windows: UsageWindow[];
  error?: string;
}

export interface UsageStatus {
  updated_at: number;
  providers: ProviderUsage[];
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const res = await api.get<{ data: UsageStatus }>('/gateway/usage-status');
  return res.data;
}

// ─── Token usage summary (F3.1 plan B) ──────────────────────────────
// Aggregated over our own `token_usage` table — covers ALL providers
// (raw API keys too), unlike the upstream `usage.status` RPC which is
// subscription-only. The chat header badge consumes this.

export type TokenUsageWindow = '1h' | '24h' | '7d' | '30d';

export interface TokenUsageModelRow {
  model: string;
  requests: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_usd: number;
}

export interface TokenUsageSummary {
  window: TokenUsageWindow;
  from: string;  // ISO
  to: string;    // ISO
  models: TokenUsageModelRow[];
  totals: { tokens_total: number; cost_usd: number; requests: number };
}

export async function getTokenUsageSummary(window: TokenUsageWindow = '24h'): Promise<TokenUsageSummary> {
  const res = await api.get<{ data: TokenUsageSummary }>(`/token-usage/summary?window=${window}`);
  return res.data;
}

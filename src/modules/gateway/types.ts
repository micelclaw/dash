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

export type GatewayTab = 'overview' | 'channels' | 'models' | 'sessions' | 'cron' | 'logs';

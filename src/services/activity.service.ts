/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — typed wrappers over the Core /activity/* endpoints.
 * Lets each module tab consume one shared client instead of re-coding
 * fetch + admin-gate semantics per tab.
 */

import { api } from './api';

export interface ActivityBudget {
  budget_mb: number;
  splits: { events: number; gateway: number; containers: number; core: number };
}

export interface BucketSize {
  bucket: 'events' | 'gateway' | 'containers' | 'core';
  bytes: number;
  cap_bytes: number;
  files: number;
}

export interface HistogramRow {
  bucket: string; // ISO timestamp (truncated to hour)
  severity: string;
  count: number;
}

export interface ActivityStats {
  window_hours: number;
  budget: ActivityBudget;
  buckets: BucketSize[];
  events: {
    total: number;
    by_severity: Record<string, number>;
    histogram: HistogramRow[];
  };
}

export interface BuiltinRule {
  key: string;
  description: string;
  defaults: Record<string, unknown>;
  enabled: boolean;
  threshold: Record<string, unknown>;
  overridden: boolean;
}

export interface RuleOverride {
  rule_key: string;
  enabled: boolean;
  threshold: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivitySettingsResponse {
  budget: ActivityBudget;
  rule_overrides: RuleOverride[];
}

export interface AgentEventRow {
  id: string;
  type: string;
  severity: string;
  source_agent_id: string | null;
  target_agent_id: string | null;
  user_id: string | null;
  payload: Record<string, unknown>;
  schema_version: number;
  processed: boolean;
  created_at: string;
}

export interface CoreLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  req_id?: string;
  raw?: Record<string, unknown>;
}

export interface CoreLogsResponse {
  enabled: boolean;
  path: string | null;
  entries: CoreLogEntry[];
}

export interface ContainerLogEntry {
  timestamp: string;
  stream: string;
  message: string;
}

export interface ContainerLogsResponse {
  service: string;
  path: string;
  file_size: number;
  entries: ContainerLogEntry[];
}

export interface MergedContainerLogsResponse {
  merged: true;
  entries: Array<ContainerLogEntry & { service: string }>;
}

export interface ActiveTailsResponse {
  tails: Array<{ service: string; filepath: string }>;
}

// ─── Activity stats + settings ─────────────────────────────────────

export async function getActivityStats(windowHours = 24): Promise<ActivityStats> {
  const { data } = await api.get<{ data: ActivityStats }>('/activity/stats', { window: `${windowHours}h` });
  return data;
}

export async function getActivitySettings(): Promise<ActivitySettingsResponse> {
  const { data } = await api.get<{ data: ActivitySettingsResponse }>('/activity/settings');
  return data;
}

export async function setActivityBudget(budgetMb: number): Promise<ActivityBudget> {
  const { data } = await api.patch<{ data: { budget: ActivityBudget } }>('/activity/settings', { budget_mb: budgetMb });
  return data.budget;
}

export async function getNotificationRules(): Promise<BuiltinRule[]> {
  const { data } = await api.get<{ data: { rules: BuiltinRule[] } }>('/activity/notification-rules');
  return data.rules;
}

export async function patchNotificationRule(
  ruleKey: string,
  patch: { enabled?: boolean; threshold?: Record<string, unknown> },
): Promise<RuleOverride> {
  const { data } = await api.patch<{ data: { rule_override: RuleOverride } }>(
    `/activity/notification-rules/${encodeURIComponent(ruleKey)}`,
    patch,
  );
  return data.rule_override;
}

/**
 * "Reset to defaults" — re-enables the rule and clears any custom
 * threshold by re-applying defaults via PATCH. The api client doesn't
 * expose DELETE so we don't drop the override row; the rule just acts
 * as if no override existed (Core's `thresholdsFor` merges with defaults
 * regardless).
 */
export async function resetNotificationRule(ruleKey: string): Promise<RuleOverride> {
  return patchNotificationRule(ruleKey, { enabled: true, threshold: {} });
}

// ─── Events feed ────────────────────────────────────────────────────

export async function listEvents(params: {
  type?: string;
  limit?: number;
  before?: string;
  processed?: 'true' | 'false';
}): Promise<{ events: AgentEventRow[] }> {
  const query: Record<string, string | number | undefined> = {};
  if (params.type) query.type = params.type;
  if (params.limit) query.limit = params.limit;
  if (params.before) query.before = params.before;
  if (params.processed) query.processed = params.processed;
  const { data } = await api.get<{ data: { events: AgentEventRow[] } }>('/agent-events', query);
  return data;
}

// ─── Core logs ──────────────────────────────────────────────────────

export async function getCoreLogs(opts: { limit?: number; tailBytes?: number } = {}): Promise<CoreLogsResponse> {
  const query: Record<string, number | undefined> = {};
  if (opts.limit) query.limit = opts.limit;
  if (opts.tailBytes) query.tail_bytes = opts.tailBytes;
  const { data } = await api.get<{ data: CoreLogsResponse }>('/core/logs', query);
  return data;
}

// ─── Gateway logs (re-exposed from existing endpoint for the tab) ───

export interface GatewayLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

export async function getGatewayLogs(opts: { tail?: number } = {}): Promise<{ entries: GatewayLogEntry[] }> {
  const query: Record<string, number | undefined> = {};
  if (opts.tail) query.tail = opts.tail;
  const { data } = await api.get<{ data: { entries: GatewayLogEntry[] } }>('/gateway/logs', query);
  return data;
}

// ─── Container logs (per-service + merged) ──────────────────────────

export async function getActiveTails(): Promise<ActiveTailsResponse> {
  const { data } = await api.get<{ data: ActiveTailsResponse }>('/lifecycle/services/logs/active');
  return data;
}

export async function getServiceLogs(
  service: string,
  opts: { tailBytes?: number; limit?: number } = {},
): Promise<ContainerLogsResponse> {
  const query: Record<string, number | undefined> = {};
  if (opts.tailBytes) query.tail_bytes = opts.tailBytes;
  if (opts.limit) query.limit = opts.limit;
  const { data } = await api.get<{ data: ContainerLogsResponse }>(`/lifecycle/services/${encodeURIComponent(service)}/logs`, query);
  return data;
}

export async function getMergedContainerLogs(
  opts: { tailBytes?: number; limit?: number } = {},
): Promise<MergedContainerLogsResponse> {
  const query: Record<string, number | undefined> = {};
  if (opts.tailBytes) query.tail_bytes = opts.tailBytes;
  if (opts.limit) query.limit = opts.limit;
  const { data } = await api.get<{ data: MergedContainerLogsResponse }>('/lifecycle/services/logs', query);
  return data;
}

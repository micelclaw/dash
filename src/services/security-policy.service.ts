/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { api } from './api';

export type SecurityExecMode = 'deny' | 'allowlist' | 'ask' | 'auto';
export type SecurityFloor = 'human_confirmation' | 'secure_confirmation' | 'deny';
export type SecurityRuleEffect = 'allow' | 'block' | 'prompt';
export type SecurityRuleTarget = 'gateway' | 'node' | 'compatible_targets';
export type SecurityCwdScope = 'agent_workspace' | 'user_workspaces' | 'explicit_path';
export type SecurityExtensionPolicy = 'none' | 'block_only' | 'allow_unprotected';
export type SecurityDriftState =
  | 'in_sync'
  | 'drifted'
  | 'unmanaged'
  | 'unavailable'
  | 'reconciliation_required';
export type SecurityRuntimeHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unavailable';
export type SecurityBreakGlassStatus =
  | 'pending_application'
  | 'active'
  | 'application_failed'
  | 'revoked'
  | 'expired';

export interface SecurityPolicySettings {
  id: string;
  singleton_key: string;
  default_exec_mode: SecurityExecMode;
  max_user_exec_mode: SecurityExecMode;
  default_profile_id: string | null;
  allow_admin_break_glass: boolean;
  break_glass_max_minutes: number;
  revision: number;
  updated_at: string;
}

export interface SecurityPostureCounts {
  total_agents: number;
  managed_agents: number;
  legacy_unmanaged: number;
  reconciliation_required: number;
  published_profiles: number;
  protected_categories: number;
  active_leases: number;
}

export interface SecurityPosture {
  recovery?: { enabled: boolean; counts: Record<string, number> };
  settings: SecurityPolicySettings;
  counts: SecurityPostureCounts;
  runtime: {
    status: SecurityRuntimeHealth | SecurityDriftState | 'available' | 'observed';
    reason?: string | null;
    gateway_effective?: Record<string, unknown> | null;
    guard?: SecurityRuntimeHealth | null;
    guard_version?: number | string | null;
    guard_errors?: unknown[];
  };
}

export interface ProtectedSecurityCategory {
  id: string;
  key: string;
  label: string;
  description: string;
  default_floor: SecurityFloor;
  floor: SecurityFloor;
  immutable: boolean;
  enabled: boolean;
  sort_order: number;
  revision: number;
  updated_at: string;
}

export interface CommandRuleInput {
  effect: SecurityRuleEffect;
  target: SecurityRuleTarget;
  executable_pattern: string;
  argument_matcher: { kind: 'exact' | 'prefix' | 'glob' | 'regex'; value: string };
  cwd_scope: SecurityCwdScope;
  cwd_path?: string | null;
  category?: string;
  description?: string;
}

export interface CommandPolicyRule extends CommandRuleInput {
  id: string;
  profile_version_id: string;
  category: string;
  fingerprint: string;
  created_at: string;
}

export interface CommandProfileVersion {
  id: string;
  profile_id: string;
  version: number;
  status: 'draft' | 'published' | 'superseded';
  changelog: string;
  published_at: string | null;
  created_at: string;
}

export interface CommandProfileSummary {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  builtin: string | null;
  extension_policy: SecurityExtensionPolicy;
  max_exec_mode: SecurityExecMode;
  latest_version: number;
  published_version: number;
  updated_at: string;
}

export interface CommandProfileDetail extends CommandProfileSummary {
  versions: CommandProfileVersion[];
  draft: CommandProfileVersion | null;
  published: CommandProfileVersion | null;
  rules: CommandPolicyRule[];
  runtime_application?: 'unavailable' | 'pending' | 'applied';
}

export interface AgentSecurityRuleOverride {
  id: string;
  agent_id: string;
  effect: SecurityRuleEffect;
  base_rule_fingerprint: string | null;
  rule: CommandRuleInput & { fingerprint?: string };
  source: 'agent_override' | 'approval_learned' | 'imported_unmanaged';
  created_at: string;
}

export interface AgentSecurityAdapter {
  id: string;
  availability: 'observed' | 'available' | 'unavailable' | string;
  requested_policy: Record<string, unknown>;
  effective_policy: Record<string, unknown>;
  source_layers: unknown[];
  revision: string | null;
  label?: string;
}

export interface AgentSecurity {
  recovery?: SecurityRecovery | null;
  agent: {
    id: string;
    user_id: string;
    name: string;
    display_name: string;
    model: string;
    workspace_path: string | null;
  };
  desired: {
    state: 'legacy_unmanaged' | 'pending_application' | 'in_sync' | 'reconciliation_required' | string;
    mode: SecurityExecMode | null;
    profile_id: string | null;
    profile_version_id: string | null;
    unattended_fallback: 'deny_and_notify' | 'deny' | 'fail_closed' | null;
    revision: number;
    applied_revision: number | null;
  };
  inherited: {
    server_default_mode: SecurityExecMode;
    defaults_apply_to: 'new_policies_only';
    owner_max_user_mode: SecurityExecMode;
    profile: {
      id: string;
      name: string;
      max_exec_mode: SecurityExecMode;
      extension_policy: SecurityExtensionPolicy;
      version: number | null;
    } | null;
  };
  rules: {
    profile: CommandPolicyRule[];
    overrides: AgentSecurityRuleOverride[];
  };
  effective: {
    status: SecurityDriftState;
    adapter_id: string | null;
    target_id: string | null;
    policy: Record<string, unknown> | null;
    observed_at: string | null;
    reason?: string | null;
  };
  drift: {
    state: SecurityDriftState;
    recovery: 'none' | 'reconcile' | 'integrate_runtime_adapter' | 'choose_managed_policy' | string;
  };
  break_glass: Array<{
    id: string;
    adapter_id: string;
    reason: string;
    status: SecurityBreakGlassStatus;
    starts_at: string;
    expires_at: string;
    effective: boolean;
    provider_application: 'observed' | 'unavailable';
    guard_policy_version: number | string | null;
  }>;
  adapters: AgentSecurityAdapter[];
}

export interface AgentSecurityPolicyInput {
  expected_revision: number;
  requested_exec_mode: SecurityExecMode;
  profile_id: string | null;
  unattended_fallback?: 'deny_and_notify' | 'deny' | 'fail_closed';
}

export interface AgentSecurityPreview {
  before: Record<string, unknown> | null;
  after: {
    requested_exec_mode: SecurityExecMode;
    profile_id: string | null;
    profile_version_id: string | null;
    unattended_fallback: string;
    desired_revision: number;
    state: string;
  };
  impact: { profile_rules: number; local_overrides: number };
  runtime_application: string;
  warnings: string[];
}

export interface SecurityAuditEntry {
  id: string;
  actor_id: string | null;
  agent_id: string | null;
  profile_id: string | null;
  action: string;
  before_state: unknown;
  after_state: unknown;
  correlation_id: string;
  result: 'success' | 'rejected' | 'failed' | 'partial';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SecurityAuditPage {
  data: SecurityAuditEntry[];
  meta: { total: number; limit: number; offset: number };
}

export type SecurityApprovalAuthority =
  | 'core_action'
  | 'openclaw_exec'
  | 'openclaw_plugin'
  | 'runtime_native'
  | 'external_mcp';

export interface SecurityApprovalDelivery {
  revision: number;
  enabled: boolean;
  authority_filters: SecurityApprovalAuthority[];
  destinations: Array<{
    /** Opaque verified-binding reference; never a raw channel recipient. */
    id: string;
    label: string;
    channel: string;
    account_label: string | null;
    available: boolean;
    selected: boolean;
    unavailable_reason:
      | 'binding_required'
      | 'account_binding_required'
      | 'channel_disconnected'
      | null;
  }>;
  in_app: {
    chat: true;
    activity_center: true;
    inbox: true;
    mutable: false;
  };
  legacy_forwarding: {
    state: 'unmanaged' | 'disabled';
    enabled: boolean;
    reason: string | null;
  };
}

/** Runtime endpoints are rolled out independently from desired-state policy. */
export interface SecurityRuntimeAdapterStatus {
  id: string;
  label: string;
  family: 'host_exec' | 'runtime' | 'plugin' | 'node' | 'core';
  availability: 'supported' | 'installed' | 'enabled' | 'loaded' | 'registered' | 'healthy' | 'active' | 'unavailable';
  supported_scopes: Array<'global' | 'agent' | 'node' | 'session'>;
  supported_modes: string[];
  approval_transport: 'openclaw_exec' | 'openclaw_plugin' | 'runtime_callback' | 'internal';
  requested_policy: unknown;
  effective_policy: unknown;
  source_layers: Array<{ source: string; value: unknown }>;
  apply_effect: 'hot' | 'plugin_reload' | 'new_session' | 'gateway_restart';
  guard_capabilities: {
    preflight: boolean;
    human_bridge: boolean;
    auto_review: boolean;
    persistent_rules: boolean;
  };
  notes?: string[];
}

export interface AgentSecurityRuntime {
  recovery?: SecurityRecovery | null;
  managed: boolean;
  desired_revision: number | null;
  requested_mode: string | null;
  effective_mode: string | null;
  openclaw_exec: Record<string, unknown> | null;
  approvals: Record<string, unknown> | null;
  guard: Record<string, unknown>;
  layers: Array<{ source: string; value: unknown }>;
  drift: { state: SecurityDriftState; recovery: string };
  snapshot: Record<string, unknown> | null;
  adapters: SecurityRuntimeAdapterStatus[];
}

export interface SecurityRecovery {
  state: 'waiting_guard' | 'recovering' | 'retry_wait' | 'manual_required' | 'recovered' | 'superseded';
  cause: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  phase: string;
}

export async function getSecurityPosture(): Promise<SecurityPosture> {
  const res = await api.get<{ data: SecurityPosture }>('/security/posture');
  return res.data;
}

export async function getSecuritySettings(): Promise<SecurityPolicySettings> {
  const res = await api.get<{ data: SecurityPolicySettings }>('/security/settings');
  return res.data;
}

export async function updateSecuritySettings(
  patch: { expected_revision: number } & Partial<Pick<SecurityPolicySettings,
    'default_exec_mode' | 'max_user_exec_mode' | 'default_profile_id' |
    'allow_admin_break_glass' | 'break_glass_max_minutes'>>,
): Promise<SecurityPolicySettings> {
  const res = await api.patch<{ data: SecurityPolicySettings }>('/security/settings', patch);
  return res.data;
}

export async function listProtectedCategories(): Promise<ProtectedSecurityCategory[]> {
  const res = await api.get<{ data: ProtectedSecurityCategory[] }>('/security/protected-categories');
  return res.data ?? [];
}

export async function updateProtectedCategory(
  id: string,
  input: { expected_revision: number; floor: SecurityFloor },
): Promise<ProtectedSecurityCategory> {
  const res = await api.patch<{ data: ProtectedSecurityCategory }>(
    `/security/protected-categories/${id}`,
    input,
  );
  return res.data;
}

export async function listCommandProfiles(): Promise<CommandProfileSummary[]> {
  const res = await api.get<{ data: CommandProfileSummary[] }>('/security/command-profiles');
  return res.data ?? [];
}

export async function getCommandProfile(id: string): Promise<CommandProfileDetail> {
  const res = await api.get<{ data: CommandProfileDetail }>(`/security/command-profiles/${id}`);
  return res.data;
}

export async function createCommandProfile(input: {
  name: string;
  description?: string;
  extension_policy?: SecurityExtensionPolicy;
  max_exec_mode?: SecurityExecMode;
  changelog?: string;
  rules?: CommandRuleInput[];
}): Promise<CommandProfileDetail> {
  const res = await api.post<{ data: CommandProfileDetail }>('/security/command-profiles', input);
  return res.data;
}

export async function updateCommandProfile(
  id: string,
  input: {
    expected_version: number;
    name?: string;
    description?: string;
    extension_policy?: SecurityExtensionPolicy;
    max_exec_mode?: SecurityExecMode;
    changelog?: string;
    rules?: CommandRuleInput[];
  },
): Promise<CommandProfileDetail> {
  const res = await api.patch<{ data: CommandProfileDetail }>(`/security/command-profiles/${id}`, input);
  return res.data;
}

export async function previewCommandProfilePublish(
  id: string,
  expectedVersion: number,
): Promise<Record<string, unknown>> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `/security/command-profiles/${id}/preview-publish`,
    { expected_version: expectedVersion },
  );
  return res.data;
}

export async function publishCommandProfile(id: string, expectedVersion: number): Promise<CommandProfileDetail> {
  const res = await api.post<{ data: CommandProfileDetail }>(
    `/security/command-profiles/${id}/publish`,
    { expected_version: expectedVersion },
  );
  return res.data;
}

export async function rollbackCommandProfile(
  id: string,
  expectedVersion: number,
  targetVersion: number,
): Promise<CommandProfileDetail> {
  const res = await api.post<{ data: CommandProfileDetail }>(
    `/security/command-profiles/${id}/rollback`,
    { expected_version: expectedVersion, target_version: targetVersion },
  );
  return res.data;
}

export async function getAgentSecurity(agentId: string): Promise<AgentSecurity> {
  const res = await api.get<{ data: AgentSecurity }>(`/managed-agents/${agentId}/security`);
  return res.data;
}

export async function previewAgentSecurity(
  agentId: string,
  input: AgentSecurityPolicyInput,
): Promise<AgentSecurityPreview> {
  const res = await api.post<{ data: AgentSecurityPreview }>(
    `/managed-agents/${agentId}/security/preview`,
    input,
  );
  return res.data;
}

export async function updateAgentSecurity(
  agentId: string,
  input: AgentSecurityPolicyInput,
): Promise<AgentSecurity> {
  const res = await api.patch<{ data: AgentSecurity }>(`/managed-agents/${agentId}/security`, input);
  return res.data;
}

export async function addAgentSecurityRule(
  agentId: string,
  input: { effect: SecurityRuleEffect; base_rule_fingerprint?: string | null; rule?: CommandRuleInput },
): Promise<AgentSecurityRuleOverride> {
  const res = await api.post<{ data: AgentSecurityRuleOverride }>(
    `/managed-agents/${agentId}/security/rules`,
    input,
  );
  return res.data;
}

export async function revokeAgentSecurityRule(agentId: string, ruleId: string): Promise<void> {
  await api.delete(`/managed-agents/${agentId}/security/rules/${ruleId}`);
}

export async function requestAgentBreakGlass(
  agentId: string,
  input: { duration_minutes: 5 | 15 | 30 | 60; reason: string; pin: string; adapter_id?: string },
): Promise<void> {
  await api.post(`/managed-agents/${agentId}/security/break-glass`, input);
}

export async function revokeAgentBreakGlass(agentId: string, leaseId: string): Promise<void> {
  await api.delete(`/managed-agents/${agentId}/security/break-glass/${leaseId}`);
}

export async function listSecurityAudit(input: {
  agent_id?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SecurityAuditPage> {
  return api.get<SecurityAuditPage>('/security/audit', input);
}

export async function getSecurityApprovalDelivery(): Promise<SecurityApprovalDelivery> {
  const res = await api.get<{ data: SecurityApprovalDelivery }>('/security/approval-delivery');
  return res.data;
}

export async function updateSecurityApprovalDelivery(input: {
  expected_revision: number;
  enabled: boolean;
  destination_ids: string[];
  authority_filters: SecurityApprovalAuthority[];
}): Promise<SecurityApprovalDelivery> {
  const res = await api.patch<{ data: SecurityApprovalDelivery }>('/security/approval-delivery', input);
  return res.data;
}

export async function listRuntimeAdapters(): Promise<SecurityRuntimeAdapterStatus[]> {
  const res = await api.get<{ data: SecurityRuntimeAdapterStatus[] }>('/security/runtime-adapters');
  return res.data ?? [];
}

export async function getAgentSecurityRuntime(agentId: string): Promise<AgentSecurityRuntime> {
  const res = await api.get<{ data: AgentSecurityRuntime }>(`/managed-agents/${agentId}/security/runtime`);
  return res.data;
}

export async function reconcileAgentSecurity(agentId: string): Promise<Record<string, unknown>> {
  const res = await api.post<{ data: Record<string, unknown> }>(`/managed-agents/${agentId}/security/reconcile`);
  return res.data;
}

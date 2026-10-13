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

// ─── Agents admin service ──────────────────────────────────────────
//
// Wraps `/api/v1/agent-tokens/*` (agent API tokens — Dev section only)
// and `/api/v1/managed-agents/*/tool-access` (Tool Access Defaults
// section under AI & Agents) endpoints. Both are admin/dev surfaces
// for managing agents at the configuration layer.

import { api } from './api';

// ─── Types: agent tokens ────────────────────────────────────────────

export interface AgentToken {
  id: string;
  name: string;
  scopes: string[];
  agent_id: string | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface CreateTokenResponse {
  id: string;
  name: string;
  scopes: string[];
  token: string;
}

// ─── Types: tool access ─────────────────────────────────────────────

export interface ToolAccessGlobal {
  profile: string | null;
  allow: string[] | null;
  also_allow: string[] | null;
  deny: string[] | null;
}

export interface ToolAccessResponseData {
  global: ToolAccessGlobal;
  agent: Record<string, unknown>;
  openclaw_agent_id: string;
}

export interface ManagedAgentRef {
  id: string;
}

/**
 * Full managed-agent record — different consumers (PermissionsSection,
 * ToolAccessDefaultsSection) need different fields. Returned as a
 * generic record; consumers narrow to what they need.
 */
export type ManagedAgent = Record<string, unknown> & { id: string };

// ─── Agent tokens ───────────────────────────────────────────────────

export async function listTokens(): Promise<AgentToken[]> {
  const res = await api.get<{ data: AgentToken[] }>('/agent-tokens');
  return res.data ?? [];
}

export async function createToken(params: {
  name: string;
  scopes: string[];
}): Promise<CreateTokenResponse> {
  const res = await api.post<{ data: CreateTokenResponse }>('/agent-tokens', params);
  return res.data;
}

export async function updateToken(id: string, patch: { name?: string }): Promise<void> {
  await api.patch(`/agent-tokens/${id}`, patch);
}

export async function deleteToken(id: string): Promise<void> {
  await api.delete(`/agent-tokens/${id}`);
}

// ─── Managed agents (admin views) ───────────────────────────────────

export async function listManagedAgents(): Promise<ManagedAgent[]> {
  const res = await api.get<{ data: ManagedAgent[] }>('/managed-agents');
  return res.data ?? [];
}

export async function getToolAccess(agentId: string): Promise<ToolAccessResponseData> {
  const res = await api.get<{ data: ToolAccessResponseData }>(
    `/managed-agents/${agentId}/tool-access`,
  );
  return res.data;
}

export async function updateToolAccess(
  agentId: string,
  body: {
    scope: 'global' | 'agent';
    profile: string;
    allow: string[] | null;
    deny: string[] | null;
  },
): Promise<void> {
  await api.patch(`/managed-agents/${agentId}/tool-access`, body);
}

/**
 * Assign a model to an agent (fully-qualified id, e.g. "nvidia/nemotron-3").
 * Applies to NEW sessions. Timeout 150s: the write goes through the Gateway's
 * FIFO config queue and under rate-limit pressure can take >60s to land
 * (same ceiling as the credential writes).
 */
export async function updateAgentModel(agentId: string, model: string): Promise<void> {
  await api.post(`/managed-agents/${agentId}/set-model`, { model }, { timeout: 150_000 });
}

export interface DecisionModelEntry {
  provider: string;
  id: string;
  name?: string;
  label?: string;
  availability?: boolean;
  incompatible_reason?: 'credential-missing' | 'connection-mode' | null;
  pluginId?: string;
}

export interface AgentDecisionModelState {
  mode: 'inherit' | 'disabled' | 'model';
  model: string | null;
  global_model: string | null;
  effective_model: string | null;
}

export async function listDecisionModels(): Promise<{ models: DecisionModelEntry[]; default_model: string | null }> {
  const res = await api.get<{ data: { models: DecisionModelEntry[]; default_model: string | null } }>('/gateway/decision-models');
  return res.data;
}

export async function getAgentDecisionModel(agentId: string): Promise<AgentDecisionModelState> {
  const res = await api.get<{ data: AgentDecisionModelState }>(`/managed-agents/${agentId}/decision-model`);
  return res.data;
}

export async function updateAgentDecisionModel(agentId: string, body: { mode: AgentDecisionModelState['mode']; model?: string }): Promise<AgentDecisionModelState> {
  const res = await api.patch<{ data: AgentDecisionModelState }>(`/managed-agents/${agentId}/decision-model`, body, { timeout: 240_000 });
  return res.data;
}

export async function testAgentDecisionModel(agentId: string, body: {
  type: 'choice' | 'score' | 'boolean';
  text: string;
  criteria: Record<string, string> | string[];
}): Promise<Record<string, unknown>> {
  const res = await api.post<{ data: Record<string, unknown> }>(`/managed-agents/${agentId}/decision-model/test`, body, { timeout: 65_000 });
  return res.data;
}

// IN1-P: `updateManagedAgent` (el PATCH genérico que usaba PermissionsSection para
// escribir `permissions.allowed_domains`) se elimina con su único consumidor. El
// modelo viejo ya no tiene cliente en el dash Y el backend rechaza esa clave
// (400 PERMISSIONS_DOMAINS_REMOVED). Los scopes los concede la app/skill asignada.

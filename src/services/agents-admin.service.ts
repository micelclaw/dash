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
 * Generic agent patch (used by PermissionsSection to update the
 * `permissions` field — allowed_domains + tag_filter).
 */
export async function updateManagedAgent(
  agentId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/managed-agents/${agentId}`, body);
}

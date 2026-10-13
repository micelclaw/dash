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

// ─── Approvals & permissions service ────────────────────────────────
//
// Wraps `/api/v1/approvals/history` (read-only audit log) and
// `/api/v1/admin/scope-preview` (data-access count preview used by
// the Permissions section). Cohesive domain — both are about
// permission decisions and their consequences.

import { api } from './api';
import type { ApprovalRequest } from '@/types/settings';

export type ApprovalDecision = 'allow_once' | 'allow_session' | 'allow_persistent_rule' | 'deny';

export interface ApprovalListPage {
  data: ApprovalRequest[];
  meta: { total: number; limit: number; offset: number };
}

export interface ApprovalHistoryEntry {
  id: string;
  operation: string;
  requested_by: string;
  decision: Exclude<ApprovalRequest['status'], 'pending'>;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

/** Per-domain count returned by scope-preview. */
export interface ScopePreviewResult {
  [domain: string]: { total: number; filtered: number };
}

export interface ScopePreviewParams {
  allowed_domains: string[];
  // Fase 3.6: filtro por etiqueta por-dominio.
  tag_filters: Record<string, { mode: 'include' | 'exclude'; tags: string[] }>;
}

export async function listHistory(): Promise<ApprovalHistoryEntry[]> {
  const res = await listApprovalHistory();
  return (res.data ?? []).flatMap((entry) => entry.status === 'pending' ? [] : [{
    id: entry.id,
    operation: entry.operation,
    requested_by: entry.requested_by,
    decision: entry.status,
    resolved_by: entry.resolved_by ?? undefined,
    created_at: entry.created_at,
    resolved_at: entry.resolved_at ?? undefined,
  }]);
}

export async function listApprovals(input: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ApprovalListPage> {
  return api.get<ApprovalListPage>('/approvals', input);
}

export async function listApprovalHistory(input: {
  limit?: number;
  offset?: number;
} = {}): Promise<ApprovalListPage> {
  return api.get<ApprovalListPage>('/approvals/history', input);
}

export async function resolveApproval(
  id: string,
  input: { decision: ApprovalDecision; credential?: string; reason?: string },
): Promise<ApprovalRequest> {
  const res = await api.post<{ data: ApprovalRequest }>(`/approvals/${id}/resolve`, input);
  return res.data;
}

/** Aprobación PENDIENTE (shape del GET /approvals, subset que usa el chat). */
export interface PendingApproval {
  id: string;
  operation: string;
  summary: string;
  level: number;
  expires_at: string;
  conversation_id?: string | null;
  source?: ApprovalRequest['source'];
  authority?: ApprovalRequest['authority'];
  risk?: ApprovalRequest['risk'];
  core_level?: number | null;
  allowed_decisions?: Array<'allow-once' | 'allow-always' | 'deny'>;
  resolution?: ApprovalRequest['resolution'];
  presentation?: {
    kind?: string;
    title?: string;
    summary?: string;
    tool_name?: string | null;
    provider?: string;
    secure_confirmation?: boolean;
    protected_category?: string;
  };
}

/**
 * Pendientes del usuario. El chat las usa para REHIDRATAR las tarjetas inline
 * al cargar una conversación (2026-07-16): la tarjeta solo se pintaba por el
 * WS `approval.new` en el momento de crearse — si no estabas mirando esa conv
 * justo entonces (o recargaste), no había NINGUNA forma de verla y caducaba en
 * silencio con el agente esperando para siempre (conv 43eb4f75).
 */
export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const res = await api.get<{ data: PendingApproval[] }>('/approvals', { status: 'pending' });
  return res.data ?? [];
}

export async function previewScope(params: ScopePreviewParams): Promise<ScopePreviewResult> {
  const res = await api.post<{ data: ScopePreviewResult }>('/admin/scope-preview', params);
  return res.data;
}

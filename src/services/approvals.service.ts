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

export interface ApprovalHistoryEntry {
  id: string;
  operation: string;
  requested_by: string;
  decision: 'approved' | 'rejected' | 'expired';
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
  const res = await api.get<{ data: ApprovalHistoryEntry[] }>('/approvals/history');
  return res.data ?? [];
}

export async function previewScope(params: ScopePreviewParams): Promise<ScopePreviewResult> {
  const res = await api.post<{ data: ScopePreviewResult }>('/admin/scope-preview', params);
  return res.data;
}

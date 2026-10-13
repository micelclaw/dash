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

export type WorkboardStatus =
  | 'triage' | 'backlog' | 'todo' | 'scheduled' | 'ready'
  | 'running' | 'review' | 'blocked' | 'done';

export type WorkboardPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkboardClaim {
  owner_id?: string;
  token?: string;
  claimed_at?: number;
  expires_at?: number;
  last_heartbeat_at?: number;
}

export interface WorkboardProof {
  id: string;
  status: string;
  label?: string;
  command?: string;
  url?: string;
  note?: string;
  created_at?: number;
}

export interface WorkboardComment {
  id: string;
  body: string;
  created_at: number;
  updated_at?: number;
}

export interface WorkboardRunAttempt {
  id: string;
  status: string; // running | succeeded | failed | blocked | stopped
  started_at: number;
  ended_at?: number;
  engine?: string;
  mode?: string;
  model?: string;
  error?: string;
}

export interface WorkboardStale {
  detected_at: number;
  reason: string;
  last_session_updated_at?: number;
}

export interface WorkboardEvent {
  id: string;
  kind: string;
  at: number;
  from_status?: WorkboardStatus;
  to_status?: WorkboardStatus;
}

export interface WorkboardCard {
  id: string;
  title: string;
  notes?: string;
  status: WorkboardStatus;
  priority: WorkboardPriority;
  labels: string[];
  agent_id?: string;
  source_url?: string;
  task_id?: string;
  position: number;
  created_at: number;
  updated_at: number;
  started_at?: number;
  completed_at?: number;
  metadata?: {
    automation?: { board_id?: string };
    stale?: WorkboardStale;
    failure_count?: number;
    archived_at?: number;
    template_id?: string;
    comments?: WorkboardComment[];
    attempts?: WorkboardRunAttempt[];
    diagnostics?: WorkboardDiagnostic[];
  } & Record<string, unknown>;
  execution?: { status?: string; engine?: string; mode?: string; model?: string };
  claim?: WorkboardClaim;
  proof?: WorkboardProof[];
  events?: WorkboardEvent[];
}

export interface WorkboardStatusResponse {
  enabled: boolean;
  reachable: boolean;
  board_id: string;
  boards: number;
  error?: { code: string; message: string } | null;
}

export interface WorkboardBoardSummary {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  total: number;
  active: number;
  archived: number;
  by_status?: Partial<Record<WorkboardStatus, number>>;
}

export interface WorkboardStats {
  id: string;
  total: number;
  active: number;
  archived: number;
  by_status?: Partial<Record<WorkboardStatus, number>>;
  by_agent?: Record<string, number>;
  oldest_ready_age_ms?: number;
}

export interface WorkboardDiagnosticAction {
  kind: 'claim' | 'unblock' | 'promote' | 'reclaim' | 'reassign' | 'add_proof' | 'open_session';
  label: string;
}

export interface WorkboardDiagnostic {
  kind: string;
  severity: 'warning' | 'error' | 'critical';
  card_id?: string;
  title?: string;
  detail?: string;
  count?: number;
  actions?: WorkboardDiagnosticAction[];
}

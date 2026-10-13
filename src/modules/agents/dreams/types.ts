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

// Shapes de los endpoints de memoria/dreaming (snake_case end-to-end; el
// envelope {data} NO lo desempaqueta api.get → tipar Env<T> en el caller).

export type Env<T> = { data: T };

export interface DreamPhase {
  enabled?: boolean;
  cron?: string;
  lookback_days?: number;
  limit?: number;
  min_score?: number;
  min_recall_count?: number;
  min_unique_queries?: number;
  recency_half_life_days?: number;
  max_age_days?: number;
  min_pattern_strength?: number;
  managed_cron_present?: boolean;
  next_run_at_ms?: number;
}

export interface DreamSignalEntry {
  key: string;
  path: string;
  start_line?: number;
  end_line?: number;
  snippet: string;
  recall_count?: number;
  daily_count?: number;
  grounded_count?: number;
  total_signal_count?: number;
  light_hits?: number;
  rem_hits?: number;
  phase_hit_count?: number;
  promoted_at?: string | number;
  last_recalled_at?: string | number;
}

export interface DreamingStatus {
  enabled?: boolean;
  timezone?: string;
  storage_mode?: string;
  short_term_count?: number;
  recall_signal_count?: number;
  daily_signal_count?: number;
  grounded_signal_count?: number;
  total_signal_count?: number;
  phase_signal_count?: number;
  light_phase_hit_count?: number;
  rem_phase_hit_count?: number;
  promoted_total?: number;
  promoted_today?: number;
  last_promoted_at?: string | number;
  short_term_entries?: DreamSignalEntry[];
  signal_entries?: DreamSignalEntry[];
  promoted_entries?: DreamSignalEntry[];
  phases?: { light?: DreamPhase; deep?: DreamPhase; rem?: DreamPhase };
}

export interface MemoryStatus {
  agent_id: string;
  provider?: string;
  embedding?: { ok?: boolean; checked?: boolean; error?: string; model?: string; dims?: number };
  dreaming?: DreamingStatus;
}

export interface DreamDiaryResponse {
  agent_id?: string;
  found?: boolean;
  path?: string;
  content?: string;
  updated_at_ms?: number;
}

export interface RemHarness {
  ok?: boolean;
  agent_id?: string;
  rem_config?: { enabled?: boolean; lookback_days?: number; limit?: number; min_pattern_strength?: number };
  deep_config?: { min_score?: number; min_recall_count?: number; min_unique_queries?: number };
  rem?: {
    skipped?: boolean;
    source_entry_count?: number;
    reflections?: string[];
    candidate_truths?: Array<{ snippet?: string; confidence?: number }>;
  };
  deep?: {
    candidate_limit?: number;
    truncated?: boolean;
    candidates?: Array<{
      key?: string; path?: string; start_line?: number; snippet?: string;
      recall_count?: number; unique_queries?: number; avg_score?: number; max_score?: number;
      age_days?: number; promoted?: boolean; promoted_at?: string | number;
    }>;
  };
}

export interface DreamingConfig {
  memory_core_enabled?: boolean;
  enabled?: boolean;
  frequency?: string;
  model?: string | null;
  timezone?: string | null;
}

export interface WikiStatus { enabled?: boolean; reachable?: boolean }

// memory-wiki: shapes defensivos (los define el plugin; la UI degrada).
export type WikiPayload = Record<string, unknown> | null;

// ── Diario parseado ──
export interface DreamEntry {
  id: string;
  date_label: string;       // texto interior de la línea *…* tal cual
  date: Date | null;
  day_key: string;          // 'YYYY-MM-DD' (o date_label si no parsea)
  body: string;
  backfill: boolean;
  backfill_day?: string;
  backfill_source?: string;
  fragment: boolean;        // snippet crudo Session:/User:/Assistant: (material de relleno)
}

export interface ParsedDiary {
  entries: DreamEntry[];
  deep_sleep: string[];
  had_markers: boolean;
  parse_ok: boolean;
}

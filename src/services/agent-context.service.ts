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

// ─── Agent context-budget service ──────────────────────────────────
//
// Wraps `GET /managed-agents/:id/context-budget` — a read-only estimate of how
// much of the model's window the agent's system prompt + apps consume. All values
// are estimates (no tokenizer): the backend uses prose /4 and tool-schema /1.3.

import { api } from './api';

export interface ContextBudgetBlock {
  name: string;
  tokens: number;
  injected_capped: boolean;
}

export interface ContextBudgetApp {
  skill_id: string;
  tier: 'core' | 'full';
  tokens: number;
}

export interface ContextBudget {
  model: string | null;
  model_window: number | null;
  system_prompt: {
    base_tokens: number;
    blocks: ContextBudgetBlock[];
  };
  apps: ContextBudgetApp[];
  native_tokens: number;
  used_tokens: number;
  free_tokens: number | null;
  source: 'estimate';
}

export async function getContextBudget(agentId: string): Promise<ContextBudget> {
  const res = await api.get<{ data: ContextBudget }>(`/managed-agents/${agentId}/context-budget`);
  return res.data;
}

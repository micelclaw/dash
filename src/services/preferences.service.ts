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

// ─── Preferences service ────────────────────────────────────────────
//
// Wraps `/api/v1/preferences/*` endpoints used by PreferencesSection
// (learned user preferences inferred by agents from past behaviour).

import { api } from './api';

export interface LearnedPreference {
  id: string;
  category: string;
  key: string;
  value: unknown;
  description: string;
  source: string;
  ai_comment: string | null;
  confidence: number;
  evidence_count: number;
  last_observed_at: string;
  created_at: string;
}

export async function listPreferences(): Promise<LearnedPreference[]> {
  const res = await api.get<{ data: LearnedPreference[] }>('/preferences');
  return res.data ?? [];
}

/** Re-run the AI comment generation across all learned preferences. */
export async function regenerateComments(): Promise<void> {
  await api.post('/preferences/regenerate-comments', {});
}

/** Forget (delete) a single learned preference by id. */
export async function deletePreference(id: string): Promise<void> {
  await api.delete(`/preferences/${id}`);
}

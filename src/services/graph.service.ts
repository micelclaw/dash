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

// ─── Graph extraction service ───────────────────────────────────────
//
// Wraps `/api/v1/graph/*` endpoints used by EntityExtractionConfig
// (knowledge-graph entity extraction worker control).

import { api } from './api';

export async function pauseExtraction(): Promise<void> {
  await api.post('/graph/extraction/pause');
}

export async function resumeExtraction(): Promise<void> {
  await api.post('/graph/extraction/resume');
}

export async function stopExtraction(): Promise<void> {
  await api.post('/graph/extraction/stop');
}

/**
 * Re-run extraction across all records (clears existing entities and
 * regenerates from scratch). Heavy operation. Returns the count of
 * jobs queued so the UI can short-circuit when there's nothing to do.
 */
export async function reExtractAll(): Promise<{ total_jobs: number }> {
  const res = await api.post<{ data: { total_jobs?: number; totalJobs?: number } }>(
    '/graph/re-extract',
    {},
  );
  // Backend has used both casings historically; normalise here.
  const data = res.data ?? {};
  return { total_jobs: data.total_jobs ?? data.totalJobs ?? 0 };
}

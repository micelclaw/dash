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

// ─── Photos service ─────────────────────────────────────────────────
//
// Wraps `/api/v1/photos/ai/*` (pipeline lifecycle, models) and
// `/api/v1/photos/models/*` (multimodal model registry) endpoints
// used by PhotoPipelineProgress and MultimodalModelSection.

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface AiStats {
  total: number;
  processed: number;
  pending: number;
  queued: number;
  with_description: number;
  skipped: number;
  worker_paused: boolean;
  models: {
    multimodal: { available: boolean; id: string | null; loaded: boolean };
    siglip: { available: boolean; size_mb: number };
    dinov2: { available: boolean; size_mb: number };
  };
}

export interface MultimodalModelStatus {
  id: string;
  label: string;
  sizeBytes: number;
  quant?: string;
  vram?: string;
  downloaded: boolean;
  loaded: boolean;
}

export interface ReprocessResult {
  reset: number;
}

export interface ResumeAllResult {
  pending: number;
}

// ─── AI pipeline ────────────────────────────────────────────────────

export async function getAiStats(): Promise<AiStats> {
  const res = await api.get<{ data: AiStats }>('/photos/ai/stats');
  return res.data;
}

export async function pausePipeline(): Promise<void> {
  await api.post('/photos/ai/pause');
}

export async function resumePipeline(): Promise<void> {
  await api.post('/photos/ai/resume');
}

/**
 * Resume + queue every photo that's still unprocessed (the ones
 * skipped during a previous abort). Returns the count queued.
 */
export async function resumeAll(): Promise<ResumeAllResult> {
  const res = await api.post<{ data: ResumeAllResult }>('/photos/ai/resume-all');
  return res.data;
}

export async function abortPipeline(): Promise<void> {
  await api.post('/photos/ai/abort');
}

export async function reprocessAll(): Promise<ReprocessResult> {
  const res = await api.post<{ data: ReprocessResult }>('/photos/ai/reprocess', {});
  return res.data;
}

export async function downloadModel(model: string): Promise<void> {
  await api.post('/photos/ai/models/download', { model });
}

// ─── Multimodal model registry ──────────────────────────────────────

export async function listMultimodalModels(): Promise<MultimodalModelStatus[]> {
  const res = await api.get<{ data: MultimodalModelStatus[] }>('/photos/models/multimodal');
  return res.data ?? [];
}

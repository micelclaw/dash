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

// ─── Studio pipeline order (SSOT) ───────────────────────────────────
// M22: single source of the linear phase order + index helper, mirrored
// from `core/src/studio/services/phase-advancement.ts::STATUS_ORDER`.
// ProjectDetailPage and PhaseSidebar both import from here so the order
// can't drift between them.

import type { StudioProjectStatus } from '@/stores/studio.store';

// Unified funnel (ADR-18): `design` (intake + canvas, pre-target) is the
// explicit first phase; the legacy scoping/concept/frontend slots stay for
// straggler rows until the 0284 migration retires them.
export const STATUS_ORDER: StudioProjectStatus[] = [
  'design', 'scoping', 'concept', 'frontend', 'foundation', 'build',
  'testing', 'packaging', 'packaged', 'published',
];

/** Index of a status in the pipeline; unknown/terminal (archived/frozen) → 0.
 *  Callers that need to treat terminal states specially do so themselves. */
export function statusIndex(status: string): number {
  const i = STATUS_ORDER.indexOf(status as StudioProjectStatus);
  return i >= 0 ? i : 0;
}

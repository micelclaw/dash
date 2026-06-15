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

/** Format seconds as m:ss (e.g. 245 → "4:05"). */
export function formatTrackDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a total duration as "1 hr 23 min" / "45 min". */
export function formatTotalDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

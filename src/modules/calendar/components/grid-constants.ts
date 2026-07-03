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

import { getWeekDayNames } from '@/lib/date-helpers';

/** Total pixel height for the 24-hour time grid (48 half-hour rows x 30px each) */
export const ROW_HEIGHT = 30;
export const TOTAL_ROWS = 48;
export const TOTAL_HEIGHT = ROW_HEIGHT * TOTAL_ROWS;
export const TIME_GUTTER_WIDTH = 56;
export const DAY_NAMES = getWeekDayNames(1);
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Snap minutes to nearest 15-minute interval */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

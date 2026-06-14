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

// Shared options for board creation (NewBoardModal) and editing (BoardSettings).

export const BOARD_COLOR_PRESETS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
] as const;

export const BOARD_VIEW_OPTIONS = [
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'dashboard', label: 'Dashboard' },
] as const;

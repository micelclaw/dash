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

import { useRef } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface UseSwipeOpts {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance (px) to count as a swipe. */
  threshold?: number;
  /** Skip while true (e.g. an event drag is in progress). */
  disabled?: boolean;
}

/**
 * Horizontal swipe detector (PhotoLightbox pattern): reads touchstart/touchend
 * only — never touchmove/preventDefault — so it coexists with vertical scroll
 * and the calendar TimeGrid's own long-press drag. Fires only when the gesture
 * is horizontal-dominant (|dx| > |dy|) and exceeds the threshold.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60, disabled }: UseSwipeOpts): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e) => {
      if (disabled || e.touches.length !== 1) { start.current = null; return; }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      if (disabled || !s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return; // not a horizontal swipe
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
  };
}

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

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  delay?: number;
  onLongPress: (e: React.TouchEvent) => void;
}

/**
 * Hook for long-press gesture on touch devices.
 * Returns touch event handlers to attach to the target element.
 */
export function useLongPress({ delay = 500, onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        onLongPress(e);
        timerRef.current = null;
      }, delay);
    },
    [delay, onLongPress],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!timerRef.current || !touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    // Cancel if moved more than 10px
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

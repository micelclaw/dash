import { useState, useEffect, useRef } from 'react';

const TRACKED_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;

/**
 * Returns true when the user has been idle for `timeoutMs` milliseconds.
 * Tracks mousemove, keydown, click, and touchstart events on document.
 */
export function useIdle(timeoutMs = 300_000): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (idle) setIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIdle(true), timeoutMs);
    }

    // Initial timer
    timerRef.current = setTimeout(() => setIdle(true), timeoutMs);

    for (const event of TRACKED_EVENTS) {
      document.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of TRACKED_EVENTS) {
        document.removeEventListener(event, resetTimer);
      }
    };
  }, [timeoutMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return idle;
}

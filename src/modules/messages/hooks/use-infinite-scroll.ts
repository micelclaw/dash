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

import { useEffect, useRef, useLayoutEffect, type RefObject } from 'react';

/**
 * Top-anchored infinite scroll for a chat thread. When the sentinel at the top
 * of the scroll container comes into view, calls `onLoadOlder()`. Preserves the
 * scroll position across the prepend (scroll anchoring) so loading older
 * messages doesn't jump the viewport.
 */
export function useInfiniteScroll(opts: {
  scrollRef: RefObject<HTMLElement | null>;
  sentinelRef: RefObject<HTMLElement | null>;
  hasMore: boolean;
  loading: boolean;
  onLoadOlder: () => void;
  /** Bump this (e.g. messages.length) so the anchor restore runs after a prepend. */
  itemCount: number;
}) {
  const { scrollRef, sentinelRef, hasMore, loading, onLoadOlder, itemCount } = opts;
  const prevHeightRef = useRef(0);
  const prevCountRef = useRef(itemCount);
  const onLoadOlderRef = useRef(onLoadOlder);
  onLoadOlderRef.current = onLoadOlder;

  // Capture scroll height right before a prepend, restore it right after.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (itemCount > prevCountRef.current && prevHeightRef.current > 0) {
      const added = el.scrollHeight - prevHeightRef.current;
      if (added > 0 && el.scrollTop < added + 8) {
        el.scrollTop += added;
      }
    }
    prevCountRef.current = itemCount;
    prevHeightRef.current = el.scrollHeight;
  }, [itemCount, scrollRef]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          prevHeightRef.current = root.scrollHeight;
          onLoadOlderRef.current();
        }
      },
      { root, rootMargin: '80px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef, scrollRef, hasMore, loading]);
}

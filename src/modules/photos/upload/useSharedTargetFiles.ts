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

import { useCallback } from 'react';

const SHARE_CACHE = 'claw-share-target';

/**
 * Drains the `claw-share-target` Cache API bucket that the service worker
 * fills when the user shares photos/videos from the phone gallery into the
 * Micelclaw PWA (see src/sw.ts + the manifest share_target). Each cached
 * Response carries the original filename in the `x-claw-name` header.
 *
 * Returns a `drain()` that reconstructs File objects and clears the bucket.
 * No-ops gracefully when the Cache API is unavailable or the bucket is empty.
 */
export function useSharedTargetFiles() {
  const drain = useCallback(async (): Promise<File[]> => {
    if (typeof caches === 'undefined') return [];
    let cache: Cache;
    try {
      cache = await caches.open(SHARE_CACHE);
    } catch {
      return [];
    }
    const keys = await cache.keys();
    if (keys.length === 0) return [];

    const files: File[] = [];
    for (const req of keys) {
      try {
        const res = await cache.match(req);
        if (!res) continue;
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('x-claw-name') ?? 'shared');
        const type = res.headers.get('content-type') || blob.type || 'application/octet-stream';
        files.push(new File([blob], name, { type }));
      } catch {
        // Skip unreadable entries.
      } finally {
        await cache.delete(req);
      }
    }
    return files;
  }, []);

  return { drain };
}

/** True when the current navigation came from a PWA share (?shared=1). */
export function isSharedTargetNavigation(): boolean {
  return new URLSearchParams(window.location.search).get('shared') === '1';
}

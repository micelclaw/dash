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

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult } from '@/types/search';

export function toKey(r: SearchResult): string {
  return `${r.domain}-${r.record_id}`;
}

export function useSearchSelection(results: SearchResult[]) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const lastToggleRef = useRef<string | null>(null);

  // Clear selection when results change
  useEffect(() => {
    setCheckedIds(new Set());
  }, [results]);

  const toggleCheck = useCallback((result: SearchResult, shiftKey: boolean) => {
    const key = toKey(result);
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastToggleRef.current) {
        const fromIdx = results.findIndex(r => toKey(r) === lastToggleRef.current);
        const toIdx = results.findIndex(r => toKey(r) === key);
        if (fromIdx >= 0 && toIdx >= 0) {
          const [start, end] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
          for (let i = start; i <= end; i++) next.add(toKey(results[i]!));
        }
      } else {
        next.has(key) ? next.delete(key) : next.add(key);
      }
      lastToggleRef.current = key;
      return next;
    });
  }, [results]);

  const clearSelection = useCallback(() => setCheckedIds(new Set()), []);

  const isChecked = useCallback((r: SearchResult) => checkedIds.has(toKey(r)), [checkedIds]);

  return { checkedIds, toggleCheck, clearSelection, isChecked };
}

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

import { useState, useCallback, useRef } from 'react';

export function usePhotoSelection(items: { id: string }[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggleRef = useRef<string | null>(null);

  const toggleSelection = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastToggleRef.current) {
        const fromIdx = items.findIndex(f => f.id === lastToggleRef.current);
        const toIdx = items.findIndex(f => f.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const [start, end] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
          for (let i = start; i <= end; i++) next.add(items[i]!.id);
        }
      } else {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      lastToggleRef.current = id;
      return next;
    });
  }, [items]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /** Reemplaza la selección entera (drag-select táctil por rango). */
  const setSelection = useCallback((ids: Set<string>) => {
    setSelectedIds(new Set(ids));
  }, []);

  /** Delta add/remove (marquee de Selecto en escritorio). */
  const applyDelta = useCallback((added: string[], removed: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of added) next.add(id);
      for (const id of removed) next.delete(id);
      return next;
    });
  }, []);

  return { selectedIds, toggleSelection, clearSelection, setSelection, applyDelta };
}

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
          for (let i = start; i <= end; i++) next.add(items[i].id);
        }
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      lastToggleRef.current = id;
      return next;
    });
  }, [items]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, toggleSelection, clearSelection };
}

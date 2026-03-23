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

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { usePhotoAiStore } from '@/stores/photo-ai.store';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';

export function useDndFaceMerge() {
  const mergeFaceClusters = usePhotoAiStore((s) => s.mergeFaceClusters);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setOverId(null);
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;

    try {
      await mergeFaceClusters(String(over.id), String(active.id));
      toast.success('Clusters merged');
    } catch {
      toast.error('Failed to merge clusters');
    }
  }, [mergeFaceClusters]);

  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  return { activeId, overId, onDragStart, onDragOver, onDragEnd, onDragCancel };
}

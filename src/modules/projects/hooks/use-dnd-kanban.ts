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
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useProjectsStore } from '@/stores/projects.store';
import { calculatePosition } from '../utils/position';
import type { DragState } from '../types';

/**
 * dnd-kit DndContext handlers for kanban board.
 */
export function useDndKanban(boardId: string) {
  const moveCard = useProjectsStore((s) => s.moveCard);
  const reorderColumn = useProjectsStore((s) => s.reorderColumn);
  const columns = useProjectsStore((s) => s.columns);
  const cards = useProjectsStore((s) => s.cards);
  const columnCardIds = useProjectsStore((s) => s.columnCardIds);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const multiSelectedIds = useProjectsStore((s) => s.multiSelectedIds);
  const clearMultiSelect = useProjectsStore((s) => s.clearMultiSelect);

  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    activeType: null,
    overId: null,
    overType: null,
  });

  const onDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type as 'card' | 'column';
    setDragState({
      activeId: String(active.id),
      activeType: type,
      overId: null,
      overType: null,
    });
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDragState(s => ({ ...s, overId: null, overType: null }));
      return;
    }
    setDragState(s => ({
      ...s,
      overId: String(over.id),
      overType: over.data.current?.type as 'card' | 'column' ?? null,
    }));
  }, []);

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setDragState({ activeId: null, activeType: null, overId: null, overType: null });

    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === 'column') {
      // Column reorder — sort by position first so indices are correct
      const colIds = boardColumnIds[boardId] ?? [];
      const sorted = [...colIds].sort(
        (a, b) => (columns[a]?.position ?? 0) - (columns[b]?.position ?? 0),
      );
      const oldIdx = sorted.indexOf(String(active.id));
      const newIdx = sorted.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(sorted, oldIdx, newIdx);
      const placedAt = reordered.indexOf(String(active.id));
      const colItems = sorted.map(id => columns[id]).filter((c): c is NonNullable<typeof c> => !!c);
      const position = calculatePosition(colItems, placedAt, String(active.id));
      reorderColumn(boardId, String(active.id), position);
      return;
    }

    if (activeType === 'card') {
      const cardId = String(active.id);
      const card = cards[cardId];
      if (!card) return;

      // Determine target column
      let targetColumnId: string;

      const overType = over.data.current?.type;
      if (overType === 'column') {
        // Dropped on empty column
        targetColumnId = String(over.id);
      } else {
        // Dropped on another card — find its column
        const overCard = cards[String(over.id)];
        if (!overCard) return;
        targetColumnId = overCard.column_id;
      }

      const movingIds = multiSelectedIds.has(cardId)
        ? Array.from(multiSelectedIds)
        : [cardId];
      const columnOrder = boardColumnIds[boardId] ?? [];
      movingIds.sort((a, b) => {
        const cardA = cards[a];
        const cardB = cards[b];
        if (!cardA || !cardB) return 0;
        const columnDelta = columnOrder.indexOf(cardA.column_id) - columnOrder.indexOf(cardB.column_id);
        return columnDelta || cardA.position - cardB.position;
      });

      const targetCards = (columnCardIds[targetColumnId] ?? [])
        .map(id => cards[id])
        .filter((c): c is NonNullable<typeof c> => !!c && !movingIds.includes(c.id))
        .sort((a, b) => a.position - b.position);

      let targetIndex: number;
      if (overType !== 'column') {
        const overIndex = targetCards.findIndex(c => c.id === String(over.id));
        targetIndex = overIndex === -1 ? targetCards.length : overIndex;
      } else {
        targetIndex = targetCards.length;
      }

      const before = targetIndex > 0 ? targetCards[targetIndex - 1]!.position : 0;
      const after = targetIndex < targetCards.length
        ? targetCards[targetIndex]!.position
        : before + ((movingIds.length + 1) * 1000);
      const gap = (after - before) / (movingIds.length + 1);

      await Promise.all(movingIds.map((id, index) =>
        moveCard(boardId, id, targetColumnId, before + (gap * (index + 1))),
      ));
      if (movingIds.length > 1) clearMultiSelect();
    }
  }, [boardId, moveCard, reorderColumn, columns, cards, columnCardIds, boardColumnIds, multiSelectedIds, clearMultiSelect]);

  return {
    dragState,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}

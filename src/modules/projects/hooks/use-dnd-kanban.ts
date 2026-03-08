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

  const onDragEnd = useCallback((event: DragEndEvent) => {
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
      const colItems = sorted.map(id => columns[id]).filter(Boolean);
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
      let targetIndex: number;

      const overType = over.data.current?.type;
      if (overType === 'column') {
        // Dropped on empty column
        targetColumnId = String(over.id);
        targetIndex = (columnCardIds[targetColumnId] ?? []).length;
      } else {
        // Dropped on another card — find its column
        const overCard = cards[String(over.id)];
        if (!overCard) return;
        targetColumnId = overCard.column_id;
        const colCards = (columnCardIds[targetColumnId] ?? [])
          .map(id => cards[id])
          .filter(Boolean);
        targetIndex = colCards.findIndex(c => c.id === String(over.id));
        if (targetIndex === -1) targetIndex = colCards.length;
      }

      const colCards = (columnCardIds[targetColumnId] ?? [])
        .map(id => cards[id])
        .filter(Boolean);
      const position = calculatePosition(colCards, targetIndex, cardId);
      moveCard(boardId, cardId, targetColumnId, position);
    }
  }, [boardId, moveCard, reorderColumn, columns, cards, columnCardIds, boardColumnIds]);

  return {
    dragState,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}

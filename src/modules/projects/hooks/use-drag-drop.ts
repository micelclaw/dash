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
import type { DropResult } from '@hello-pangea/dnd';
import { useProjectsStore } from '@/stores/projects.store';
import { calculatePosition } from '../utils/position';
import type { Card } from '../types';

export function useDragDrop(boardId: string) {
  const columns = useProjectsStore((s) => s.columns);
  const cards = useProjectsStore((s) => s.cards);
  const columnCardIds = useProjectsStore((s) => s.columnCardIds);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const moveCard = useProjectsStore((s) => s.moveCard);
  const reorderColumn = useProjectsStore((s) => s.reorderColumn);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { type, source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      if (type === 'COLUMN') {
        const colIds = boardColumnIds[boardId] ?? [];
        const sortedCols = colIds.map(id => columns[id]).filter(Boolean)
          .sort((a, b) => a.position - b.position);
        const position = calculatePosition(
          sortedCols.map((c) => ({ position: c.position, id: c.id })),
          destination.index,
          draggableId,
        );
        reorderColumn(boardId, draggableId, position);
        return;
      }

      // type === 'CARD'
      const targetColumnId = destination.droppableId;
      const targetCardIds = (columnCardIds[targetColumnId] ?? [])
        .filter(id => id !== draggableId);
      const targetCards = targetCardIds
        .map(id => cards[id])
        .filter(Boolean)
        .sort((a: Card, b: Card) => a.position - b.position);

      const position = calculatePosition(
        targetCards.map((c: Card) => ({ position: c.position, id: c.id })),
        destination.index,
        draggableId,
      );

      moveCard(boardId, draggableId, targetColumnId, position);
    },
    [boardId, columns, cards, columnCardIds, boardColumnIds, moveCard, reorderColumn],
  );

  return { onDragEnd };
}

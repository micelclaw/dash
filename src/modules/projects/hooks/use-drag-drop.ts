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

// Migrado de @hello-pangea/dnd a @dnd-kit (el resto del repo ya usa
// @dnd-kit; ver use-dnd-kanban.ts). El tipo de columna/tarjeta viaja en
// `active.data.current.type` ('column' | 'card') en vez del `type` del
// DropResult, y el índice destino se deriva del elemento `over`.

import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useProjectsStore } from '@/stores/projects.store';
import { calculatePosition } from '../utils/position';

export function useDragDrop(boardId: string) {
  const columns = useProjectsStore((s) => s.columns);
  const cards = useProjectsStore((s) => s.cards);
  const columnCardIds = useProjectsStore((s) => s.columnCardIds);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const moveCard = useProjectsStore((s) => s.moveCard);
  const reorderColumn = useProjectsStore((s) => s.reorderColumn);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const activeType = active.data.current?.type as 'card' | 'column' | undefined;

      if (activeType === 'column') {
        const colIds = boardColumnIds[boardId] ?? [];
        const sortedCols = colIds.map(id => columns[id]).filter((c): c is NonNullable<typeof c> => !!c)
          .sort((a, b) => a.position - b.position);
        const oldIdx = sortedCols.findIndex((c) => c.id === activeId);
        const newIdx = sortedCols.findIndex((c) => c.id === String(over.id));
        if (oldIdx === -1 || newIdx === -1) return;

        const reordered = arrayMove(sortedCols, oldIdx, newIdx);
        const placedAt = reordered.findIndex((c) => c.id === activeId);
        const position = calculatePosition(
          sortedCols.map((c) => ({ position: c.position, id: c.id })),
          placedAt,
          activeId,
        );
        reorderColumn(boardId, activeId, position);
        return;
      }

      if (activeType !== 'card') return;
      const card = cards[activeId];
      if (!card) return;

      // Columna destino: soltar sobre una columna (vacía) o sobre otra tarjeta.
      let targetColumnId: string;
      let targetIndex: number;
      const overType = over.data.current?.type;
      if (overType === 'column') {
        targetColumnId = String(over.id);
        targetIndex = (columnCardIds[targetColumnId] ?? []).filter(id => id !== activeId).length;
      } else {
        const overCard = cards[String(over.id)];
        if (!overCard) return;
        targetColumnId = overCard.column_id;
        const colCards = (columnCardIds[targetColumnId] ?? [])
          .filter(id => id !== activeId)
          .map(id => cards[id])
          .filter((c): c is NonNullable<typeof c> => !!c)
          .sort((a, b) => a.position - b.position);
        targetIndex = colCards.findIndex((c) => c.id === String(over.id));
        if (targetIndex === -1) targetIndex = colCards.length;
      }

      const targetCards = (columnCardIds[targetColumnId] ?? [])
        .filter(id => id !== activeId)
        .map(id => cards[id])
        .filter((c): c is NonNullable<typeof c> => !!c)
        .sort((a, b) => a.position - b.position);

      const position = calculatePosition(
        targetCards.map((c) => ({ position: c.position, id: c.id })),
        targetIndex,
        activeId,
      );

      moveCard(boardId, activeId, targetColumnId, position);
    },
    [boardId, columns, cards, columnCardIds, boardColumnIds, moveCard, reorderColumn],
  );

  return { onDragEnd };
}

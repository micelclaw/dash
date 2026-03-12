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

import React, { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectsStore } from '@/stores/projects.store';
import { useDndKanban } from '../hooks/use-dnd-kanban';
import { useCardFilters } from '../hooks/use-card-filters';
import { KanbanCard } from '../components/KanbanCard';
import { ColumnHeader } from '../components/ColumnHeader';
import { FilterBar } from '../components/FilterBar';
import { NewCardInput } from '../components/NewCardInput';
import { NewColumnInput } from '../components/NewColumnInput';
import { LayoutGrid } from 'lucide-react';
import { COLUMN_WIDTH, COLUMN_GAP, BOARD_PADDING } from '../utils/design-tokens';
import type { Card, Column, BoardSettings } from '../types';

// ─── Sortable Column ────────────────────────────────────

function SortableColumn({ column, cardIds, cards, boardId, boardSettings, matchingIds }: {
  column: Column;
  cardIds: string[];
  cards: Record<string, Card>;
  boardId: string;
  boardSettings?: BoardSettings;
  matchingIds: Set<string> | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: COLUMN_WIDTH,
    minWidth: COLUMN_WIDTH,
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    flexShrink: 0,
    opacity: isDragging ? 0.4 : 1,
  };

  const colCards = useMemo(
    () => cardIds.map(id => cards[id]).filter(Boolean),
    [cardIds, cards],
  );

  const sortableCardIds = useMemo(() => cardIds, [cardIds]);

  if (column.collapsed) {
    return (
      <div ref={setNodeRef} style={{ ...style, maxHeight: 'auto' }} {...attributes}>
        <div {...listeners}>
          <ColumnHeader column={column} cardCount={colCards.length} />
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners}>
        <ColumnHeader column={column} cardCount={colCards.length} />
      </div>

      <SortableContext items={sortableCardIds} strategy={verticalListSortingStrategy}>
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 8px 8px',
          minHeight: 60,
        }}>
          {colCards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              boardSettings={boardSettings}
              dimmed={matchingIds !== null && !matchingIds.has(card.id)}
            />
          ))}
        </div>
      </SortableContext>

      <NewCardInput boardId={boardId} columnId={column.id} />
    </div>
  );
}

// ─── Sortable Card ──────────────────────────────────────

const SortableCard = React.memo(function SortableCard({ card, boardSettings, dimmed }: { card: Card; boardSettings?: BoardSettings; dimmed?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.column_id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 6,
    opacity: isDragging ? 0.4 : dimmed ? 0.15 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard
        card={card}
        showLabelsText={boardSettings?.showLabelsText}
        showCardNumbers={boardSettings?.showCardNumbers ?? true}
        cardAging={boardSettings?.cardAging}
      />
    </div>
  );
});

// ─── Drag Overlay Renderers ─────────────────────────────

function DragOverlayCard({ card, boardSettings }: { card: Card; boardSettings?: BoardSettings }) {
  return (
    <div style={{
      transform: 'rotate(2deg)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      width: COLUMN_WIDTH - 16,
    }}>
      <KanbanCard
        card={card}
        showLabelsText={boardSettings?.showLabelsText}
        showCardNumbers={boardSettings?.showCardNumbers ?? true}
      />
    </div>
  );
}

function DragOverlayColumn({ column, cardCount }: { column: Column; cardCount: number }) {
  return (
    <div style={{
      width: COLUMN_WIDTH,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      transform: 'rotate(1deg)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
      opacity: 0.9,
    }}>
      <ColumnHeader column={column} cardCount={cardCount} />
    </div>
  );
}

// ─── Collision detection ────────────────────────────────
// When dragging a column, only consider other columns as drop targets.
// Otherwise closestCenter may match inner card droppables and the drop fails.
const columnAwareCollision: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column',
      ),
    });
  }
  return closestCenter(args);
};

// ─── Board ──────────────────────────────────────────────

export function KanbanBoard() {
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const columns = useProjectsStore((s) => s.columns);
  const cards = useProjectsStore((s) => s.cards);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const columnCardIds = useProjectsStore((s) => s.columnCardIds);
  const boards = useProjectsStore((s) => s.boards);
  const activeBoard = boards.find(b => b.id === activeBoardId);
  const boardSettings = activeBoard?.settings;

  const boardId = activeBoardId!;
  const { dragState, onDragStart, onDragOver, onDragEnd } = useDndKanban(boardId);
  const { matchingIds, hasActiveFilters } = useCardFilters();

  const orderedColumnIds = useMemo(() => {
    const colIds = boardColumnIds[boardId] ?? [];
    return [...colIds].sort((a, b) => {
      const colA = columns[a];
      const colB = columns[b];
      return (colA?.position ?? 0) - (colB?.position ?? 0);
    });
  }, [boardColumnIds, boardId, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Determine overlay content
  const activeCard = dragState.activeType === 'card' && dragState.activeId
    ? cards[dragState.activeId]
    : null;
  const activeColumn = dragState.activeType === 'column' && dragState.activeId
    ? columns[dragState.activeId]
    : null;

  // Board background
  const bgStyle: React.CSSProperties = {};
  if (boardSettings?.background) {
    const bg = boardSettings.background;
    if (bg.type === 'color') bgStyle.background = bg.value;
    else if (bg.type === 'gradient') bgStyle.background = bg.value;
  }

  // Empty state
  if (orderedColumnIds.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', ...bgStyle }}>
        <FilterBar />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--text-dim)',
        }}>
          <LayoutGrid size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 14 }}>This board has no columns yet</span>
          <NewColumnInput boardId={boardId} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', ...bgStyle }}>
    <FilterBar />
    <DndContext
      sensors={sensors}
      collisionDetection={columnAwareCollision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={orderedColumnIds} strategy={horizontalListSortingStrategy}>
        <div style={{
          display: 'flex',
          gap: COLUMN_GAP,
          padding: BOARD_PADDING,
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          alignItems: 'flex-start',
        }}>
          {orderedColumnIds.map((colId) => {
            const column = columns[colId];
            if (!column) return null;
            return (
              <SortableColumn
                key={colId}
                column={column}
                cardIds={columnCardIds[colId] ?? []}
                cards={cards}
                boardId={boardId}
                boardSettings={boardSettings}
                matchingIds={matchingIds}
              />
            );
          })}

          <NewColumnInput boardId={boardId} />
        </div>
      </SortableContext>

      <DragOverlay>
        {activeCard && <DragOverlayCard card={activeCard} boardSettings={boardSettings} />}
        {activeColumn && (
          <DragOverlayColumn
            column={activeColumn}
            cardCount={(columnCardIds[activeColumn.id] ?? []).length}
          />
        )}
      </DragOverlay>
    </DndContext>
    </div>
  );
}

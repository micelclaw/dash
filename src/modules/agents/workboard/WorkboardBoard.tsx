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

import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { WorkboardCardView } from './WorkboardCard';
import { CardDetailModal } from './CardDetailModal';
import { buildDiagIndex, type DiagIndex } from './pills';
import { buildColumns, passesFilters, type Column } from './filtering';
import { canManualMove, friendlyMove } from './lanes';
import { workboardApi } from './workboard.service';
import { ApiError } from '@/services/api';
import type { WorkboardCard, WorkboardStatus, WorkboardDiagnostic } from './types';
import type { ManagedAgent } from '../types';
import type { ViewMode, WorkboardFilters } from './WorkboardToolbar';

interface Props {
  cards: WorkboardCard[];
  agents: ManagedAgent[];
  viewMode: ViewMode;
  hideEmpty: boolean;
  filters: WorkboardFilters;
  diagnostics: WorkboardDiagnostic[];
  onChanged: () => void;
}

function DraggableCard({ card, agents, onOpen }: { card: WorkboardCard; agents: ManagedAgent[]; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { status: card.status } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      style={{ cursor: 'grab', opacity: isDragging ? 0.4 : 1, outline: 'none' }}
    >
      <WorkboardCardView card={card} agents={agents} />
    </div>
  );
}

function DroppableColumn({ col, count, children, invalid }: { col: Column; count: number; children: React.ReactNode; invalid: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, data: { moveTo: col.moveTo }, disabled: invalid });
  const showOver = isOver && !invalid;
  return (
    <div style={{ flex: '1 0 200px', minWidth: 200, maxWidth: 300, opacity: invalid ? 0.4 : 1, transition: 'opacity 0.12s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 8px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.accent }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{col.label}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{count}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: 7, minHeight: 44, padding: 6, borderRadius: 10,
          background: showOver ? 'var(--bg-subtle, rgba(59,130,246,0.10))' : 'var(--bg-subtle, rgba(127,127,127,0.04))',
          border: showOver ? '1px dashed var(--blue, #3b82f6)' : '1px solid transparent',
          transition: 'background 0.12s',
        }}
      >
        {children}
        {count === 0 && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>—</div>
        )}
      </div>
    </div>
  );
}

export function WorkboardBoard({ cards, agents, viewMode, hideEmpty, filters, diagnostics, onChanged }: Props) {
  const [selected, setSelected] = useState<WorkboardCard | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // TouchSensor con long-press: en pantallas táctiles el drag no pelea con el scroll.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const diagIndex: DiagIndex = useMemo(() => buildDiagIndex(diagnostics), [diagnostics]);
  const live = selected ? cards.find((c) => c.id === selected.id) ?? selected : null;
  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  const visible = useMemo(() => cards.filter((c) => passesFilters(c, filters, diagIndex)), [cards, filters, diagIndex]);
  const columns: Column[] = useMemo(() => buildColumns(viewMode), [viewMode]);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    if (!card) return;
    const moveTo = over.data.current?.moveTo as WorkboardStatus | undefined;
    if (!moveTo || card.status === moveTo) return;
    // El plugin gobierna algunas transiciones (scheduled aparcada) → avisamos en vez de intentar y fallar.
    if (!canManualMove(card.status, moveTo)) { toast.error(friendlyMove('card is scheduled for later')); return; }
    workboardApi.move(card.id, moveTo, card.position)
      .then(() => { toast.success('Tarea movida'); onChanged(); })
      .catch((e) => toast.error(e instanceof ApiError ? friendlyMove(e.message) : 'No se pudo mover'));
  };

  const visibleColumns = columns
    .map((col) => ({ col, laneCards: visible.filter((c) => col.statuses.includes(c.status)).sort((a, b) => a.position - b.position) }))
    .filter(({ laneCards }) => !hideEmpty || laneCards.length > 0);

  return (
    <>
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
          {visibleColumns.map(({ col, laneCards }) => (
            <DroppableColumn
              key={col.key}
              col={col}
              count={laneCards.length}
              // Mientras se arrastra: atenúa/inhabilita las columnas a las que esa card no puede ir.
              invalid={Boolean(activeCard) && !canManualMove(activeCard!.status, col.moveTo)}
            >
              {laneCards.map((c) => (
                <DraggableCard key={c.id} card={c} agents={agents} onOpen={() => { setSelected(c); setOpen(true); }} />
              ))}
            </DroppableColumn>
          ))}
          {visibleColumns.length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Ninguna tarjeta coincide con los filtros.</div>
          )}
        </div>
        <DragOverlay>
          {activeCard ? <div style={{ width: 260, cursor: 'grabbing' }}><WorkboardCardView card={activeCard} agents={agents} /></div> : null}
        </DragOverlay>
      </DndContext>

      <CardDetailModal card={live} agents={agents} diagnostics={diagnostics} open={open} onClose={() => setOpen(false)} onChanged={onChanged} />
    </>
  );
}

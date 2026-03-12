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

import { useMemo, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PriorityDot } from '../components/PriorityDot';
import { PRIORITY_COLORS } from '../utils/design-tokens';
import type { Card } from '../types';

// ─── Zoom config ──────────────────────────────────────

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { cellWidth: number; label: string }> = {
  day: { cellWidth: 40, label: 'Day' },
  week: { cellWidth: 120, label: 'Week' },
  month: { cellWidth: 200, label: 'Month' },
  quarter: { cellWidth: 80, label: 'Quarter' },
};

const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter'];
const LEFT_PANEL_WIDTH = 250;
const ROW_HEIGHT = 36;
const BAR_HEIGHT = 20;

// ─── Helpers ──────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatHeader(date: Date, zoom: ZoomLevel): string {
  switch (zoom) {
    case 'day':
      return `${date.getDate()}`;
    case 'week':
      return `W${getWeekNumber(date)}`;
    case 'month':
      return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

function getTimelineRange(cards: Card[], zoom: ZoomLevel): { start: Date; end: Date; cells: Date[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let minDate = new Date(today);
  let maxDate = new Date(today);

  for (const card of cards) {
    if (card.start_date) {
      const d = new Date(card.start_date);
      if (d < minDate) minDate = new Date(d);
    }
    if (card.due_date) {
      const d = new Date(card.due_date);
      if (d > maxDate) maxDate = new Date(d);
      if (d < minDate) minDate = new Date(d);
    }
  }

  // Add padding
  minDate = addDays(minDate, -7);
  maxDate = addDays(maxDate, 14);

  const cells: Date[] = [];
  const cursor = new Date(minDate);

  switch (zoom) {
    case 'day':
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    case 'week':
      cursor.setDate(cursor.getDate() - cursor.getDay()); // start at Sunday
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 7);
      }
      break;
    case 'month':
      cursor.setDate(1);
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
      break;
    case 'quarter':
      cursor.setDate(1);
      cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + 3);
      }
      break;
  }

  return { start: minDate, end: maxDate, cells };
}

function getCellDuration(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
  }
}

// ─── Component ────────────────────────────────────────

export function TimelineView() {
  const cardsMap = useProjectsStore((s) => s.cards);
  const columns = useProjectsStore((s) => s.columns);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);

  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [showUndated, setShowUndated] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allCards = useMemo(() => Object.values(cardsMap).filter(c => !c.archived), [cardsMap]);
  const datedCards = useMemo(() => allCards.filter(c => c.due_date || c.start_date), [allCards]);
  const undatedCards = useMemo(() => allCards.filter(c => !c.due_date && !c.start_date), [allCards]);

  const columnMap = useMemo(() => new Map(Object.values(columns).map(c => [c.id, c])), [columns]);

  const { cells } = useMemo(() => getTimelineRange(datedCards, zoom), [datedCards, zoom]);
  const cellWidth = ZOOM_CONFIG[zoom].cellWidth;
  const totalWidth = cells.length * cellWidth;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Calculate today's X position
  const todayX = useMemo(() => {
    if (cells.length === 0) return -1;
    const firstCell = cells[0];
    const days = daysBetween(firstCell, today);
    const cellDur = getCellDuration(zoom);
    return (days / cellDur) * cellWidth;
  }, [cells, today, zoom, cellWidth]);

  const zoomIn = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_ORDER[idx - 1]);
  };

  const zoomOut = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[idx + 1]);
  };

  // Drag state for bar move
  const [dragging, setDragging] = useState<{
    cardId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    card: Card,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startDate = card.start_date ?? card.due_date ?? '';
    const endDate = card.due_date ?? card.start_date ?? '';
    setDragging({
      cardId: card.id,
      mode,
      startX: e.clientX,
      origStart: startDate,
      origEnd: endDate,
    });

    const handleMove = (ev: MouseEvent) => {
      // Visual feedback handled via CSS (cursor)
    };

    const handleUp = (ev: MouseEvent) => {
      if (!dragging && !activeBoardId) {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        return;
      }

      const dx = ev.clientX - e.clientX;
      const cellDur = getCellDuration(zoom);
      const daysDelta = Math.round((dx / cellWidth) * cellDur);

      if (daysDelta !== 0 && activeBoardId) {
        const origStartD = new Date(startDate);
        const origEndD = new Date(endDate);

        let newStart: Date;
        let newEnd: Date;

        switch (mode) {
          case 'move':
            newStart = addDays(origStartD, daysDelta);
            newEnd = addDays(origEndD, daysDelta);
            break;
          case 'resize-start':
            newStart = addDays(origStartD, daysDelta);
            newEnd = origEndD;
            break;
          case 'resize-end':
            newStart = origStartD;
            newEnd = addDays(origEndD, daysDelta);
            break;
        }

        updateCard(activeBoardId, card.id, {
          start_date: newStart.toISOString().split('T')[0],
          due_date: newEnd.toISOString().split('T')[0],
        });
      }

      setDragging(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [activeBoardId, cellWidth, zoom, updateCard, dragging]);

  // Calculate bar position for a card
  const getBarStyle = useCallback((card: Card): { left: number; width: number } | null => {
    const startStr = card.start_date ?? card.due_date;
    const endStr = card.due_date ?? card.start_date;
    if (!startStr || !endStr || cells.length === 0) return null;

    const start = new Date(startStr);
    const end = new Date(endStr);
    const firstCell = cells[0];
    const cellDur = getCellDuration(zoom);

    const startDays = daysBetween(firstCell, start);
    const endDays = daysBetween(firstCell, end);

    const left = (startDays / cellDur) * cellWidth;
    const width = Math.max(((endDays - startDays + 1) / cellDur) * cellWidth, cellWidth * 0.3);

    return { left, width };
  }, [cells, zoom, cellWidth]);

  if (allCards.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 14 }}>
        No cards yet. Add cards from the Board view.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <button onClick={zoomIn} style={navBtnStyle} title="Zoom in"><ZoomIn size={14} /></button>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 50, textAlign: 'center' }}>
          {ZOOM_CONFIG[zoom].label}
        </span>
        <button onClick={zoomOut} style={navBtnStyle} title="Zoom out"><ZoomOut size={14} /></button>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {datedCards.length} scheduled, {undatedCards.length} unscheduled
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: card list */}
        <div style={{
          width: LEFT_PANEL_WIDTH,
          minWidth: LEFT_PANEL_WIDTH,
          borderRight: '1px solid var(--border)',
          overflow: 'auto',
        }}>
          {/* Header row */}
          <div style={{
            height: 32,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Card
            </span>
          </div>

          {/* Card rows */}
          {datedCards.map((card) => {
            const col = columnMap.get(card.column_id);
            return (
              <div
                key={card.id}
                onClick={() => selectCard(card.id)}
                style={{
                  height: ROW_HEIGHT,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text)',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <PriorityDot priority={card.priority ?? 'none'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {card.card_number != null && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>#{card.card_number}</span>}
                  {card.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right panel: timeline */}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {/* Header cells */}
          <div style={{
            display: 'flex',
            height: 32,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            minWidth: totalWidth,
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}>
            {cells.map((date, i) => {
              const isToday = zoom === 'day' && date.getTime() === today.getTime();
              return (
                <div
                  key={i}
                  style={{
                    width: cellWidth,
                    minWidth: cellWidth,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: isToday ? 'var(--amber)' : 'var(--text-dim)',
                    fontWeight: isToday ? 700 : 400,
                    borderRight: '1px solid var(--border)',
                  }}
                >
                  {formatHeader(date, zoom)}
                </div>
              );
            })}
          </div>

          {/* Bar rows */}
          <div style={{ position: 'relative', minWidth: totalWidth }}>
            {/* Today marker */}
            {todayX >= 0 && todayX <= totalWidth && (
              <div style={{
                position: 'absolute',
                left: todayX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--error)',
                opacity: 0.6,
                zIndex: 1,
              }} />
            )}

            {datedCards.map((card) => {
              const bar = getBarStyle(card);
              const isMilestone = card.start_date === card.due_date;
              const cardColor = card.color || PRIORITY_COLORS[card.priority ?? 'none'] || 'var(--amber)';

              // Checklist progress
              const checklist = card.checklist ?? [];
              const progress = checklist.length > 0
                ? checklist.filter(c => c.checked).length / checklist.length
                : 0;

              return (
                <div
                  key={card.id}
                  style={{
                    height: ROW_HEIGHT,
                    borderBottom: '1px solid var(--border)',
                    position: 'relative',
                  }}
                >
                  {/* Grid cells background */}
                  <div style={{ display: 'flex', position: 'absolute', inset: 0 }}>
                    {cells.map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: cellWidth,
                          minWidth: cellWidth,
                          borderRight: '1px solid var(--border)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Bar */}
                  {bar && !isMilestone && (
                    <div
                      style={{
                        position: 'absolute',
                        left: bar.left,
                        width: bar.width,
                        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                        height: BAR_HEIGHT,
                        background: cardColor + 'aa',
                        borderRadius: 4,
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        zIndex: 1,
                      }}
                      onMouseDown={(e) => handleBarMouseDown(e, card, 'move')}
                      onClick={(e) => { e.stopPropagation(); selectCard(card.id); }}
                    >
                      {/* Progress fill */}
                      {progress > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${progress * 100}%`,
                          background: cardColor,
                          borderRadius: '4px 0 0 4px',
                        }} />
                      )}

                      {/* Resize handles */}
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, card, 'resize-start')}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 6,
                          cursor: 'ew-resize',
                          zIndex: 2,
                        }}
                      />
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, card, 'resize-end')}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 6,
                          cursor: 'ew-resize',
                          zIndex: 2,
                        }}
                      />

                      {/* Title (visible if bar is wide enough) */}
                      {bar.width > 60 && (
                        <span style={{
                          position: 'relative',
                          zIndex: 1,
                          fontSize: 10,
                          color: '#fff',
                          padding: '0 8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {card.title}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Milestone diamond */}
                  {bar && isMilestone && (
                    <div
                      onClick={(e) => { e.stopPropagation(); selectCard(card.id); }}
                      style={{
                        position: 'absolute',
                        left: bar.left - 6,
                        top: (ROW_HEIGHT - 12) / 2,
                        width: 12,
                        height: 12,
                        background: cardColor,
                        transform: 'rotate(45deg)',
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Undated cards */}
      {undatedCards.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 16px',
          background: 'var(--surface)',
        }}>
          <button
            onClick={() => setShowUndated(!showUndated)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {showUndated ? <ChevronLeft size={12} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={12} />}
            Unscheduled ({undatedCards.length})
          </button>
          {showUndated && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, maxHeight: 120, overflow: 'auto' }}>
              {undatedCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => selectCard(card.id)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: 'var(--text)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PriorityDot priority={card.priority ?? 'none'} />
                  {card.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
};

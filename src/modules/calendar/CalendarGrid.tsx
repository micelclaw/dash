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

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { getWeekDays, isSameDay, isToday } from '@/lib/date-helpers';
import { ROW_HEIGHT, TOTAL_HEIGHT, TIME_GUTTER_WIDTH, snapMinutes } from './components/grid-constants';
import { TimeGridHeader, AllDayRow } from './components/TimeGridHeader';
import { TimeGutter, DayColumn } from './components/DayColumn';
import { MonthGrid } from './components/MonthGrid';
import { AgendaView } from './components/AgendaView';
import type { CalendarView, CalendarEvent, EventUpdateInput } from './types';

interface CalendarGridProps {
  view: CalendarView;
  currentDate: Date;
  events: CalendarEvent[];
  hiddenCalendars: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  onEventUpdate?: (id: string, input: EventUpdateInput) => void;
  onEventDelete?: (id: string) => void;
  calendarColorMap?: Record<string, string>;
}

export function CalendarGrid({
  view,
  currentDate,
  events,
  hiddenCalendars,
  onEventClick,
  onSlotClick,
  onEventUpdate,
  onEventDelete,
  calendarColorMap,
}: CalendarGridProps) {
  const visibleEvents = useMemo(
    () => events.filter((ev) => !hiddenCalendars.has(ev.calendar_name)),
    [events, hiddenCalendars],
  );

  switch (view) {
    case 'day':
      return (
        <TimeGrid
          days={[currentDate]}
          events={visibleEvents}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
          onEventUpdate={onEventUpdate}
          onEventDelete={onEventDelete}
          calendarColorMap={calendarColorMap}
        />
      );
    case 'week':
      return (
        <TimeGrid
          days={getWeekDays(currentDate)}
          events={visibleEvents}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
          onEventUpdate={onEventUpdate}
          onEventDelete={onEventDelete}
          calendarColorMap={calendarColorMap}
        />
      );
    case 'month':
      return (
        <MonthGrid
          currentDate={currentDate}
          events={visibleEvents}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
          onEventDelete={onEventDelete}
          calendarColorMap={calendarColorMap}
        />
      );
    case 'agenda':
      return (
        <AgendaView
          currentDate={currentDate}
          events={visibleEvents}
          onEventClick={onEventClick}
          onEventDelete={onEventDelete}
          calendarColorMap={calendarColorMap}
        />
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  TimeGrid (shared by Day and Week views)                                   */
/* -------------------------------------------------------------------------- */

interface TimeGridProps {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  onEventUpdate?: (id: string, input: EventUpdateInput) => void;
  onEventDelete?: (id: string) => void;
  calendarColorMap?: Record<string, string>;
}

function TimeGrid({ days, events, onEventClick, onSlotClick, onEventUpdate, onEventDelete, calendarColorMap }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnCount = days.length;

  // Auto-scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * ROW_HEIGHT * 2; // 8 hours * 2 rows/hour * 30px
    }
  }, []);

  // Split events into all-day vs timed
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];
    for (const ev of events) {
      if (ev.all_day) {
        allDay.push(ev);
      } else {
        timed.push(ev);
      }
    }
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Group timed events by day column index
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (let i = 0; i < columnCount; i++) map.set(i, []);
    for (const ev of timedEvents) {
      const evStart = new Date(ev.start_at);
      for (let i = 0; i < columnCount; i++) {
        if (isSameDay(evStart, days[i]!)) {
          map.get(i)!.push(ev);
          break;
        }
      }
    }
    return map;
  }, [timedEvents, days, columnCount]);

  // Group all-day events by day column index
  const allDayByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (let i = 0; i < columnCount; i++) map.set(i, []);
    for (const ev of allDayEvents) {
      const evStart = new Date(ev.start_at);
      for (let i = 0; i < columnCount; i++) {
        if (isSameDay(evStart, days[i]!)) {
          map.get(i)!.push(ev);
          break;
        }
      }
    }
    return map;
  }, [allDayEvents, days, columnCount]);

  const hasAllDay = allDayEvents.length > 0;

  // Current time indicator position
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 1440) * TOTAL_HEIGHT;

  const handleSlotClick = useCallback(
    (dayIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = Math.floor((y / TOTAL_HEIGHT) * 1440);
      const hours = Math.floor(totalMinutes / 30) * 0.5; // snap to half hour
      const snappedHours = Math.floor(hours);
      const snappedMinutes = (hours % 1) * 60;
      const date = new Date(days[dayIndex]!);
      date.setHours(snappedHours, snappedMinutes, 0, 0);
      onSlotClick?.(date);
    },
    [days, onSlotClick],
  );

  // ─── Drag-and-drop state ──────────────────────────────────────────
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ col: number; top: number; height: number } | null>(null);

  const handleEventDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    setDragEventId(event.id);
    e.dataTransfer.setData('application/claw-event-id', event.id);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image so we show our own preview
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, []);

  const handleColumnDragOver = useCallback((colIndex: number, e: React.DragEvent) => {
    if (!dragEventId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = snapMinutes(Math.floor((y / TOTAL_HEIGHT) * 1440));

    // Calculate the dragged event's original duration
    const ev = events.find(ev => ev.id === dragEventId);
    if (!ev) return;
    const evStart = new Date(ev.start_at);
    const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
    const durationMin = Math.max((evEnd.getTime() - evStart.getTime()) / 60000, 15);

    const previewTop = (totalMinutes / 1440) * TOTAL_HEIGHT;
    const previewHeight = (durationMin / 1440) * TOTAL_HEIGHT;

    setDragPreview({ col: colIndex, top: previewTop, height: previewHeight });
  }, [dragEventId, events]);

  const handleColumnDrop = useCallback((colIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragPreview(null);
    setDragEventId(null);

    const eventId = e.dataTransfer.getData('application/claw-event-id');
    if (!eventId || !onEventUpdate) return;

    const ev = events.find(ev => ev.id === eventId);
    if (!ev) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = snapMinutes(Math.floor((y / TOTAL_HEIGHT) * 1440));
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;

    // Calculate duration to preserve it
    const evStart = new Date(ev.start_at);
    const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
    const durationMs = evEnd.getTime() - evStart.getTime();

    // Build new start/end on the target day
    const targetDay = new Date(days[colIndex]!);
    const newStart = new Date(targetDay);
    newStart.setHours(newHours, newMinutes, 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    onEventUpdate(eventId, {
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
    });
  }, [days, events, onEventUpdate]);

  const handleDragEnd = useCallback(() => {
    setDragPreview(null);
    setDragEventId(null);
  }, []);

  // ─── Resize state ─────────────────────────────────────────────────
  const [resizeState, setResizeState] = useState<{
    eventId: string;
    startClientY: number;
    originalEndMin: number;
    originalStartMin: number;
  } | null>(null);
  const [resizePreviewHeight, setResizePreviewHeight] = useState<number | null>(null);
  const resizeRef = useRef(resizeState);
  resizeRef.current = resizeState;

  const handleResizeStart = useCallback((event: CalendarEvent, clientY: number) => {
    const evStart = new Date(event.start_at);
    const evEnd = event.end_at ? new Date(event.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
    const startMin = evStart.getHours() * 60 + evStart.getMinutes();
    const endMin = evEnd.getHours() * 60 + evEnd.getMinutes();

    setResizeState({
      eventId: event.id,
      startClientY: clientY,
      originalEndMin: endMin,
      originalStartMin: startMin,
    });
  }, []);

  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rs = resizeRef.current;
      if (!rs) return;
      const deltaY = e.clientY - rs.startClientY;
      const deltaMinutes = snapMinutes(Math.floor((deltaY / TOTAL_HEIGHT) * 1440));
      const newEndMin = Math.max(rs.originalStartMin + 15, rs.originalEndMin + deltaMinutes);
      const newHeight = ((newEndMin - rs.originalStartMin) / 1440) * TOTAL_HEIGHT;
      setResizePreviewHeight(Math.max(newHeight, 20));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const rs = resizeRef.current;
      if (!rs || !onEventUpdate) {
        setResizeState(null);
        setResizePreviewHeight(null);
        return;
      }

      const ev = events.find(ev => ev.id === rs.eventId);
      if (!ev) {
        setResizeState(null);
        setResizePreviewHeight(null);
        return;
      }

      const deltaY = e.clientY - rs.startClientY;
      const deltaMinutes = snapMinutes(Math.floor((deltaY / TOTAL_HEIGHT) * 1440));
      const newEndMin = Math.max(rs.originalStartMin + 15, rs.originalEndMin + deltaMinutes);
      const newEndHours = Math.floor(newEndMin / 60);
      const newEndMinutes = newEndMin % 60;

      const evStart = new Date(ev.start_at);
      const newEnd = new Date(evStart);
      newEnd.setHours(newEndHours, newEndMinutes, 0, 0);

      onEventUpdate(rs.eventId, {
        end_at: newEnd.toISOString(),
      });

      setResizeState(null);
      setResizePreviewHeight(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, events, onEventUpdate]);

  // ─── Drag táctil por PULSACIÓN LARGA (móvil) ──────────────────────
  // El drag nativo HTML5 (handleEventDragStart/DragOver/Drop) NO dispara en táctil, así
  // que en móvil no se podían mover eventos. Aquí replicamos el mismo comportamiento con
  // eventos touch: mantener pulsado 250ms sobre un evento entra en modo arrastre; luego
  // el dedo mueve el evento entre columnas/horas (misma matemática de slot). Un toque
  // corto no arranca drag (deja el onClick para abrir el evento) y un arrastre temprano
  // (>10px antes del delay) se interpreta como scroll y cancela.
  const touchDragRef = useRef<{ eventId: string; started: boolean } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleEventTouchStart = useCallback((event: CalendarEvent, clientX: number, clientY: number) => {
    if (!onEventUpdate) return;
    touchStartPos.current = { x: clientX, y: clientY };
    touchDragRef.current = { eventId: event.id, started: false };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      touchDragRef.current = { eventId: event.id, started: true };
      setDragEventId(event.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    }, 250);
  }, [onEventUpdate, clearLongPress]);

  useEffect(() => {
    // Localiza la columna-día bajo el dedo y calcula el slot horario (idéntico a
    // handleColumnDragOver/Drop, pero desde coordenadas touch).
    const columnAt = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY);
      const col = el?.closest('[data-day-col]') as HTMLElement | null;
      if (!col) return null;
      const colIndex = Number(col.dataset.dayCol);
      const rect = col.getBoundingClientRect();
      const totalMinutes = snapMinutes(Math.floor(((clientY - rect.top) / TOTAL_HEIGHT) * 1440));
      return { colIndex, totalMinutes };
    };

    const onTouchMove = (e: TouchEvent) => {
      const td = touchDragRef.current;
      if (!td) return;
      const t = e.touches[0];
      if (!t) return;
      if (!td.started) {
        // Aún en el delay: si el dedo se mueve > 10px es scroll → cancelar long-press.
        const sp = touchStartPos.current;
        if (sp && Math.hypot(t.clientX - sp.x, t.clientY - sp.y) > 10) {
          clearLongPress();
          touchDragRef.current = null;
        }
        return;
      }
      e.preventDefault(); // en modo drag bloqueamos el scroll y suprimimos el click/callout
      const hit = columnAt(t.clientX, t.clientY);
      if (!hit) return;
      const ev = events.find((x) => x.id === td.eventId);
      if (!ev) return;
      const evStart = new Date(ev.start_at);
      const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
      const durationMin = Math.max((evEnd.getTime() - evStart.getTime()) / 60000, 15);
      setDragPreview({
        col: hit.colIndex,
        top: (hit.totalMinutes / 1440) * TOTAL_HEIGHT,
        height: (durationMin / 1440) * TOTAL_HEIGHT,
      });
    };

    const onTouchEnd = (e: TouchEvent) => {
      clearLongPress();
      const td = touchDragRef.current;
      touchDragRef.current = null;
      touchStartPos.current = null;
      if (!td || !td.started) return;
      setDragPreview(null);
      setDragEventId(null);
      const t = e.changedTouches[0];
      if (!t || !onEventUpdate) return;
      const hit = columnAt(t.clientX, t.clientY);
      if (!hit) return;
      const ev = events.find((x) => x.id === td.eventId);
      if (!ev) return;
      const evStart = new Date(ev.start_at);
      const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
      const durationMs = evEnd.getTime() - evStart.getTime();
      const targetDay = new Date(days[hit.colIndex]!);
      const newStart = new Date(targetDay);
      newStart.setHours(Math.floor(hit.totalMinutes / 60), hit.totalMinutes % 60, 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);
      onEventUpdate(ev.id, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [events, days, onEventUpdate, clearLongPress]);

  return (
    <div
      onDragEnd={handleDragEnd}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Sticky header row */}
      <TimeGridHeader days={days} />

      {/* All-day section (if applicable) */}
      {hasAllDay && (
        <AllDayRow
          days={days}
          allDayByDay={allDayByDay}
          onEventClick={onEventClick}
          onEventDelete={onEventDelete}
          calendarColorMap={calendarColorMap}
        />
      )}

      {/* Scrollable time grid body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(${columnCount}, 1fr)`,
            minHeight: TOTAL_HEIGHT,
            position: 'relative',
          }}
        >
          {/* Time gutter */}
          <TimeGutter />

          {/* Day columns */}
          {days.map((day, colIndex) => (
            <DayColumn
              key={colIndex}
              colIndex={colIndex}
              isLastColumn={colIndex === columnCount - 1}
              today={isToday(day)}
              events={eventsByDay.get(colIndex) || []}
              nowTop={nowTop}
              dragPreview={dragPreview}
              dragEventId={dragEventId}
              resizingEventId={resizeState?.eventId ?? null}
              resizePreviewHeight={resizePreviewHeight}
              editable={!!onEventUpdate}
              onSlotClick={handleSlotClick}
              onDragOver={handleColumnDragOver}
              onDrop={handleColumnDrop}
              onEventClick={onEventClick}
              onEventDelete={onEventDelete}
              onEventDragStart={handleEventDragStart}
              onEventTouchStart={handleEventTouchStart}
              onResizeStart={handleResizeStart}
              calendarColorMap={calendarColorMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

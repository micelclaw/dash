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
              onResizeStart={handleResizeStart}
              calendarColorMap={calendarColorMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

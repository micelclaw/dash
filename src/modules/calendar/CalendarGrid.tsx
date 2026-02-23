import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  getWeekDays,
  getMonthGridDays,
  getWeekDayNames,
  isSameDay,
  isSameMonth,
  isToday,
  formatTime,
  formatDateLong,
  addDays,
  startOfDay,
} from '@/lib/date-helpers';
import { getCalendarColor } from './types';
import type { CalendarView, CalendarEvent, EventUpdateInput } from './types';
import { EventBlock } from './EventBlock';

interface CalendarGridProps {
  view: CalendarView;
  currentDate: Date;
  events: CalendarEvent[];
  hiddenCalendars: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
  onEventUpdate?: (id: string, input: EventUpdateInput) => void;
}

/** Total pixel height for the 24-hour time grid (48 half-hour rows x 30px each) */
const ROW_HEIGHT = 30;
const TOTAL_ROWS = 48;
const TOTAL_HEIGHT = ROW_HEIGHT * TOTAL_ROWS;
const TIME_GUTTER_WIDTH = 56;
const DAY_NAMES = getWeekDayNames(1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Snap minutes to nearest 15-minute interval */
function snapMinutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

export function CalendarGrid({
  view,
  currentDate,
  events,
  hiddenCalendars,
  onEventClick,
  onSlotClick,
  onEventUpdate,
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
        />
      );
    case 'month':
      return (
        <MonthGrid
          currentDate={currentDate}
          events={visibleEvents}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
        />
      );
    case 'agenda':
      return (
        <AgendaView
          currentDate={currentDate}
          events={visibleEvents}
          onEventClick={onEventClick}
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
  onSlotClick: (date: Date) => void;
  onEventUpdate?: (id: string, input: EventUpdateInput) => void;
}

function TimeGrid({ days, events, onEventClick, onSlotClick, onEventUpdate }: TimeGridProps) {
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
      onSlotClick(date);
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(${columnCount}, 1fr)`,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Empty gutter corner */}
        <div style={{ borderRight: '1px solid var(--border)' }} />
        {/* Day headers */}
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '6px 4px',
                borderRight: i < columnCount - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{
                  fontSize: '0.625rem',
                  color: today ? 'var(--amber)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                {DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: today ? 'var(--amber)' : 'var(--text)',
                  width: 28,
                  height: 28,
                  lineHeight: '28px',
                  borderRadius: 'var(--radius-full)',
                  background: today ? 'var(--amber-dim)' : 'transparent',
                  margin: '2px auto 0',
                }}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day section (if applicable) */}
      {hasAllDay && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(${columnCount}, 1fr)`,
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              padding: '4px 6px',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            all-day
          </div>
          {days.map((_, i) => {
            const dayAllDay = allDayByDay.get(i) || [];
            return (
              <div
                key={i}
                style={{
                  padding: '2px 2px',
                  borderRight: i < columnCount - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minHeight: 28,
                }}
              >
                {dayAllDay.map((ev) => (
                  <EventBlock key={ev.id} event={ev} onClick={onEventClick} />
                ))}
              </div>
            );
          })}
        </div>
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
          <div style={{ position: 'relative', borderRight: '1px solid var(--border)' }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: hour * ROW_HEIGHT * 2,
                  right: 8,
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                  transform: 'translateY(-50%)',
                  userSelect: 'none',
                }}
              >
                {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIndex) => {
            const dayEvents = eventsByDay.get(colIndex) || [];
            const today = isToday(day);

            return (
              <div
                key={colIndex}
                onClick={(e) => handleSlotClick(colIndex, e)}
                onDragOver={(e) => handleColumnDragOver(colIndex, e)}
                onDrop={(e) => handleColumnDrop(colIndex, e)}
                style={{
                  position: 'relative',
                  borderRight: colIndex < columnCount - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Hour gridlines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: hour * ROW_HEIGHT * 2,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--border)',
                    }}
                  />
                ))}

                {/* Half-hour gridlines */}
                {HOURS.map((hour) => (
                  <div
                    key={`half-${hour}`}
                    style={{
                      position: 'absolute',
                      top: hour * ROW_HEIGHT * 2 + ROW_HEIGHT,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--border)',
                      opacity: 0.4,
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {today && (
                  <div
                    style={{
                      position: 'absolute',
                      top: nowTop,
                      left: -1,
                      right: 0,
                      height: 2,
                      background: 'var(--amber)',
                      zIndex: 3,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: -4,
                        top: -3,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--amber)',
                      }}
                    />
                  </div>
                )}

                {/* Drag preview ghost */}
                {dragPreview && dragPreview.col === colIndex && (
                  <div
                    style={{
                      position: 'absolute',
                      top: dragPreview.top,
                      left: 2,
                      right: 4,
                      height: dragPreview.height,
                      background: 'var(--amber-dim)',
                      border: '2px dashed var(--amber)',
                      borderRadius: 'var(--radius-sm)',
                      zIndex: 4,
                      pointerEvents: 'none',
                      opacity: 0.7,
                    }}
                  />
                )}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const evStart = new Date(ev.start_at);
                  const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
                  const startMin = evStart.getHours() * 60 + evStart.getMinutes();
                  const endMin = evEnd.getHours() * 60 + evEnd.getMinutes();
                  const durationMin = Math.max(endMin - startMin, 15);
                  const top = (startMin / 1440) * TOTAL_HEIGHT;
                  const height = (durationMin / 1440) * TOTAL_HEIGHT;

                  // Apply resize preview height if this is the event being resized
                  const isResizing = resizeState?.eventId === ev.id;
                  const blockHeight = isResizing && resizePreviewHeight != null
                    ? resizePreviewHeight
                    : Math.max(height, 20);

                  const isDragging = dragEventId === ev.id;

                  return (
                    <EventBlock
                      key={ev.id}
                      event={ev}
                      onClick={onEventClick}
                      heightPx={blockHeight}
                      draggable={!!onEventUpdate}
                      onDragStart={handleEventDragStart}
                      resizable={!!onEventUpdate}
                      onResizeStart={handleResizeStart}
                      style={{
                        position: 'absolute',
                        top,
                        left: 2,
                        right: 4,
                        height: blockHeight,
                        zIndex: 2,
                        opacity: isDragging ? 0.4 : 1,
                        transition: isDragging ? 'none' : undefined,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MonthGrid                                                                 */
/* -------------------------------------------------------------------------- */

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

function MonthGrid({ currentDate, events, onEventClick, onSlotClick }: MonthGridProps) {
  const gridDays = useMemo(() => getMonthGridDays(currentDate), [currentDate]);

  // Group events by day string
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const MAX_PILLS = 3;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            style={{
              textAlign: 'center',
              padding: '6px 0',
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Date cells -- 6 rows of 7 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          flex: 1,
        }}
      >
        {gridDays.map((day, i) => {
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const dayEvents = eventsByDay.get(dayKey(day)) || [];
          const visible = dayEvents.slice(0, MAX_PILLS);
          const overflowCount = dayEvents.length - MAX_PILLS;

          return (
            <div
              key={i}
              onClick={() => onSlotClick(startOfDay(day))}
              style={{
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: i < 35 ? '1px solid var(--border)' : 'none',
                padding: 4,
                minHeight: 80,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: today ? 700 : 400,
                    color: today
                      ? 'var(--amber)'
                      : inMonth
                        ? 'var(--text)'
                        : 'var(--text-muted)',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-full)',
                    border: today ? '1.5px solid var(--amber)' : 'none',
                    background: today ? 'var(--amber-dim)' : 'transparent',
                  }}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Event pills */}
              {visible.map((ev) => {
                const color = getCalendarColor(ev.calendar_name);
                return (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '1px 4px',
                      marginBottom: 1,
                      borderRadius: 'var(--radius-sm)',
                      background: `${color}1a`,
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.625rem',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ev.title}
                    </span>
                  </div>
                );
              })}

              {overflowCount > 0 && (
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--text-dim)',
                    padding: '0 4px',
                  }}
                >
                  +{overflowCount} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AgendaView                                                                */
/* -------------------------------------------------------------------------- */

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

function AgendaView({ events, onEventClick }: AgendaViewProps) {
  // Group events by date
  const grouped = useMemo(() => {
    const map = new Map<string, { date: Date; events: CalendarEvent[] }>();
    const sorted = [...events].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
    for (const ev of sorted) {
      const d = new Date(ev.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) {
        map.set(key, { date: startOfDay(d), events: [] });
      }
      map.get(key)!.events.push(ev);
    }
    return Array.from(map.values());
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
        }}
      >
        No upcoming events
      </div>
    );
  }

  return (
    <div
      style={{
        overflow: 'auto',
        height: '100%',
        fontFamily: 'var(--font-sans)',
        padding: '8px 16px',
      }}
    >
      {grouped.map(({ date, events: dayEvents }) => {
        const today = isToday(date);
        const tomorrow = isSameDay(date, addDays(new Date(), 1));
        const dayLabel = today
          ? 'Today'
          : tomorrow
            ? 'Tomorrow'
            : '';

        return (
          <div key={date.toISOString()} style={{ marginBottom: 16 }}>
            {/* Day header */}
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: today ? 'var(--amber)' : 'var(--text)',
                padding: '8px 0 4px',
                borderBottom: '1px solid var(--border)',
                marginBottom: 4,
              }}
            >
              {dayLabel ? `${dayLabel}, ` : ''}
              {formatDateLong(date)}
            </div>

            {/* Events */}
            {dayEvents.map((ev) => {
              const start = new Date(ev.start_at);
              const end = ev.end_at ? new Date(ev.end_at) : null;
              const color = getCalendarColor(ev.calendar_name);

              return (
                <div
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 8px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: `background var(--transition-fast)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Time */}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-dim)',
                      width: 100,
                      flexShrink: 0,
                    }}
                  >
                    {ev.all_day
                      ? 'All day'
                      : `${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`}
                  </span>

                  {/* Color dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />

                  {/* Title */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: '0.8125rem',
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.title}
                  </span>

                  {/* Calendar badge */}
                  <span
                    style={{
                      fontSize: '0.625rem',
                      color: 'var(--text-muted)',
                      background: `${color}1a`,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      flexShrink: 0,
                    }}
                  >
                    {ev.calendar_name}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

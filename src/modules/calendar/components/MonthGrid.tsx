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

import { EntitySource } from '@/components/shared/SourceBadge';
import { useMemo } from 'react';
import { getMonthGridDays, isSameMonth, isToday, startOfDay } from '@/lib/date-helpers';
import { getCalendarColor } from '../types';
import type { CalendarEvent } from '../types';
import { DAY_NAMES } from './grid-constants';

const MAX_PILLS = 3;

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  onEventDelete?: (id: string) => void;
  calendarColorMap?: Record<string, string>;
}

export function MonthGrid({ currentDate, events, onEventClick, onSlotClick, calendarColorMap }: MonthGridProps) {
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
        {gridDays.map((day, i) => (
          <MonthDayCell
            key={i}
            day={day}
            inMonth={isSameMonth(day, currentDate)}
            today={isToday(day)}
            events={eventsByDay.get(dayKey(day)) || []}
            showRightBorder={(i + 1) % 7 !== 0}
            showBottomBorder={i < 35}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            calendarColorMap={calendarColorMap}
          />
        ))}
      </div>
    </div>
  );
}

interface MonthDayCellProps {
  day: Date;
  inMonth: boolean;
  today: boolean;
  events: CalendarEvent[];
  showRightBorder: boolean;
  showBottomBorder: boolean;
  onSlotClick?: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  calendarColorMap?: Record<string, string>;
}

/** One day cell of the month grid: day number + up to MAX_PILLS event pills */
function MonthDayCell({
  day,
  inMonth,
  today,
  events,
  showRightBorder,
  showBottomBorder,
  onSlotClick,
  onEventClick,
  calendarColorMap,
}: MonthDayCellProps) {
  const visible = events.slice(0, MAX_PILLS);
  const overflowCount = events.length - MAX_PILLS;

  return (
    <div
      onClick={() => onSlotClick?.(startOfDay(day))}
      style={{
        borderRight: showRightBorder ? '1px solid var(--border)' : 'none',
        borderBottom: showBottomBorder ? '1px solid var(--border)' : 'none',
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
      {visible.map((ev) => (
        <MonthEventPill key={ev.id} event={ev} onEventClick={onEventClick} calendarColorMap={calendarColorMap} />
      ))}

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
}

interface MonthEventPillProps {
  event: CalendarEvent;
  onEventClick: (event: CalendarEvent) => void;
  calendarColorMap?: Record<string, string>;
}

/** Compact event chip inside a month day cell */
function MonthEventPill({ event, onEventClick, calendarColorMap }: MonthEventPillProps) {
  const color = getCalendarColor(event.calendar_name, calendarColorMap);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
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
        {event.title}
      </span>
      <span style={{ marginLeft: "auto", display: "inline-flex" }}><EntitySource entity={event} domain="calendar" size="xs" /></span>
    </div>
  );
}

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

import { isToday } from '@/lib/date-helpers';
import { EventBlock } from '../EventBlock';
import { DAY_NAMES, TIME_GUTTER_WIDTH } from './grid-constants';
import type { CalendarEvent } from '../types';

interface TimeGridHeaderProps {
  days: Date[];
}

/** Sticky header row with the day names and day numbers of the visible range */
export function TimeGridHeader({ days }: TimeGridHeaderProps) {
  const columnCount = days.length;

  return (
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
  );
}

interface AllDayRowProps {
  days: Date[];
  /** All-day events grouped by day column index */
  allDayByDay: Map<number, CalendarEvent[]>;
  onEventClick: (event: CalendarEvent) => void;
  onEventDelete?: (id: string) => void;
  calendarColorMap?: Record<string, string>;
}

/** Row under the header holding the all-day events of each visible day */
export function AllDayRow({ days, allDayByDay, onEventClick, onEventDelete, calendarColorMap }: AllDayRowProps) {
  const columnCount = days.length;

  return (
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
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {dayAllDay.map((ev) => (
              <EventBlock key={ev.id} event={ev} onClick={onEventClick} onDelete={() => onEventDelete?.(ev.id)} calendarColorMap={calendarColorMap} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

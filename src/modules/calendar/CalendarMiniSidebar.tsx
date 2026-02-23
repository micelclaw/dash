import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getMonthGridDays,
  getWeekDayNames,
  addMonths,
  isSameDay,
  isSameMonth,
  isToday,
  formatMonthYear,
} from '@/lib/date-helpers';
import { getCalendarColor } from './types';
import type { CalendarEvent } from './types';

interface CalendarMiniSidebarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  hiddenCalendars: Set<string>;
  onToggleCalendar: (name: string) => void;
  events: CalendarEvent[];
}

const DAY_NAMES = getWeekDayNames(1);

// Default calendars to always show in the list even if no events exist
const DEFAULT_CALENDARS = ['Personal', 'Work', 'Shared'];

export function CalendarMiniSidebar({
  currentDate,
  onDateChange,
  hiddenCalendars,
  onToggleCalendar,
  events,
}: CalendarMiniSidebarProps) {
  const [miniMonth, setMiniMonth] = useState(() => new Date(currentDate));

  const gridDays = useMemo(() => getMonthGridDays(miniMonth), [miniMonth]);

  // Build a set of date strings that have events for dot indicators
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of events) {
      const d = new Date(ev.start_at);
      dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return dates;
  }, [events]);

  // Extract unique calendar names from events, merged with defaults
  const calendarNames = useMemo(() => {
    const names = new Set<string>(DEFAULT_CALENDARS);
    for (const ev of events) {
      if (ev.calendar_name) names.add(ev.calendar_name);
    }
    return Array.from(names);
  }, [events]);

  const hasEvent = (d: Date) =>
    eventDates.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-sans)',
        borderRight: '1px solid var(--border)',
        overflow: 'auto',
      }}
    >
      {/* Mini calendar header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 8px',
        }}
      >
        <button onClick={() => setMiniMonth(addMonths(miniMonth, -1))} style={navBtn}>
          <ChevronLeft size={14} />
        </button>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {formatMonthYear(miniMonth)}
        </span>
        <button onClick={() => setMiniMonth(addMonths(miniMonth, 1))} style={navBtn}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 8px',
        }}
      >
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            style={{
              textAlign: 'center',
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
              padding: '2px 0',
            }}
          >
            {name.charAt(0)}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 8px 12px',
          gap: 1,
        }}
      >
        {gridDays.map((day, i) => {
          const inMonth = isSameMonth(day, miniMonth);
          const today = isToday(day);
          const selected = isSameDay(day, currentDate);
          const hasEv = hasEvent(day);

          return (
            <button
              key={i}
              onClick={() => onDateChange(day)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 30,
                margin: '0 auto',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.6875rem',
                fontWeight: today ? 700 : 400,
                background: selected
                  ? 'var(--amber)'
                  : today
                    ? 'var(--amber-dim)'
                    : 'transparent',
                color: selected
                  ? '#06060a'
                  : today
                    ? 'var(--amber)'
                    : inMonth
                      ? 'var(--text)'
                      : 'var(--text-muted)',
                transition: `background var(--transition-fast)`,
                position: 'relative',
              }}
            >
              {day.getDate()}
              {hasEv && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: selected ? '#06060a' : 'var(--amber)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

      {/* Calendar list */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          Calendars
        </div>
        {calendarNames.map((name) => {
          const color = getCalendarColor(name);
          const hidden = hiddenCalendars.has(name);

          return (
            <label
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                color: hidden ? 'var(--text-muted)' : 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={!hidden}
                onChange={() => onToggleCalendar(name)}
                style={{
                  accentColor: color,
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                }}
              />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                  opacity: hidden ? 0.3 : 1,
                }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

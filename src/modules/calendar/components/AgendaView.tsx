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
import { addDays, isSameDay, isToday, startOfDay } from '@/lib/date-helpers';
import { formatDate, formatGridTime } from '@/i18n/format';
import { getCalendarColor } from '../types';
import type { CalendarEvent } from '../types';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings.store';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDelete?: (id: string) => void;
  calendarColorMap?: Record<string, string>;
}

export function AgendaView({ events, onEventClick, calendarColorMap }: AgendaViewProps) {
  const { t, locale } = useI18n();
  const general = useSettingsStore((s) => s.serverSettings?.general);
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
        {t('calendar.noUpcomingEvents')}
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
          ? t('calendar.today')
          : tomorrow
            ? t('calendar.tomorrow')
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
              {formatDate(date, locale, general)}
            </div>

            {/* Events */}
            {dayEvents.map((ev) => (
              <AgendaEventRow key={ev.id} event={ev} onEventClick={onEventClick} calendarColorMap={calendarColorMap} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface AgendaEventRowProps {
  event: CalendarEvent;
  onEventClick: (event: CalendarEvent) => void;
  calendarColorMap?: Record<string, string>;
}

/** One event row of the agenda list: time, color dot, title and calendar badge */
function AgendaEventRow({ event, onEventClick, calendarColorMap }: AgendaEventRowProps) {
  const { t, locale } = useI18n();
  const general = useSettingsStore((s) => s.serverSettings?.general);
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const color = getCalendarColor(event.calendar_name, calendarColorMap);

  return (
    <div
      onClick={() => onEventClick(event)}
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
        {event.all_day
          ? t('calendar.allDayShort')
          : `${formatGridTime(start, locale, general)}${end ? ` – ${formatGridTime(end, locale, general)}` : ''}`}
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
        {event.title}
      </span>

      <EntitySource entity={event} domain="calendar" />

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
        {event.source === 'kanban'
          ? (event.custom_fields?.board_title as string) ?? event.calendar_name
          : event.calendar_name}
      </span>
    </div>
  );
}

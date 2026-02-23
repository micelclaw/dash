import { useState, type CSSProperties } from 'react';
import { formatTime } from '@/lib/date-helpers';
import { getCalendarColor } from './types';
import type { CalendarEvent } from './types';

interface EventBlockProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  style?: CSSProperties;
  /** Pixel height of the block — used to decide how much info to show */
  heightPx?: number;
}

export function EventBlock({ event, onClick, style, heightPx }: EventBlockProps) {
  const [hovered, setHovered] = useState(false);
  const color = getCalendarColor(event.calendar_name);
  const lines = heightPx ? Math.floor(heightPx / 18) : 1;

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  const timeStr = endDate
    ? `${formatTime(startDate)} – ${formatTime(endDate)}`
    : formatTime(startDate);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${color}25` : `${color}1a`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-sm)',
        padding: '2px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        minHeight: 20,
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.3,
        transition: `background var(--transition-fast)`,
        ...style,
      }}
    >
      {/* Compact: title + time on same line */}
      {lines <= 2 ? (
        <div
          style={{
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 500,
          }}
        >
          {event.title}
          {lines === 2 && (
            <span style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.6875rem' }}>
              {' · '}{timeStr}
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Title */}
          <div
            style={{
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: 500,
            }}
          >
            {event.title}
          </div>

          {/* Time */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text)', opacity: 0.7 }}>
            {timeStr}
          </div>

          {/* Location (4+ lines) */}
          {lines >= 4 && event.location && (
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text)',
                opacity: 0.6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              📍 {event.location}
            </div>
          )}

          {/* Attendees (5+ lines) */}
          {lines >= 5 && event.attendees.length > 0 && (
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text)',
                opacity: 0.6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              👤 {event.attendees.slice(0, 2).map(a => a.name || a.email.split('@')[0]).join(', ')}
              {event.attendees.length > 2 ? ` +${event.attendees.length - 2}` : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}

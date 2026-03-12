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

import { useState, useCallback, type CSSProperties } from 'react';
import { formatTime } from '@/lib/date-helpers';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { getCalendarColor } from './types';
import type { CalendarEvent } from './types';

interface EventBlockProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  onDelete?: () => void;
  style?: CSSProperties;
  /** Pixel height of the block — used to decide how much info to show */
  heightPx?: number;
  /** Enable drag-and-drop move */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, event: CalendarEvent) => void;
  /** Enable bottom-edge resize */
  resizable?: boolean;
  onResizeStart?: (event: CalendarEvent, clientY: number) => void;
  /** Optional color overrides map (e.g. for kanban board colors) */
  calendarColorMap?: Record<string, string>;
}

export function EventBlock({ event, onClick, onDelete, style, heightPx, draggable, onDragStart, resizable, onResizeStart, calendarColorMap }: EventBlockProps) {
  const [hovered, setHovered] = useState(false);
  const color = getCalendarColor(event.calendar_name, calendarColorMap);
  const lines = heightPx ? Math.floor(heightPx / 18) : 1;

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  const timeStr = endDate
    ? `${formatTime(startDate)} – ${formatTime(endDate)}`
    : formatTime(startDate);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, event);
    }
  }, [onDragStart, event]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onResizeStart) {
      onResizeStart(event, e.clientY);
    }
  }, [onResizeStart, event]);

  return (
    <EntityContextMenu
      entityType="event"
      entityId={event.id}
      entityTitle={event.title}
      onEdit={() => onClick(event)}
      onDelete={onDelete}
      trigger={
    <div
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
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
        cursor: draggable ? 'grab' : 'pointer',
        overflow: 'hidden',
        minHeight: 20,
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.3,
        transition: `background var(--transition-fast)`,
        position: 'relative',
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
          <div style={{ fontSize: '0.6875rem', color: 'var(--text)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
            {timeStr}
            <HeatBadge score={event.heat_score ?? 0} size={6} />
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
          {lines >= 5 && (event.attendees?.length ?? 0) > 0 && (
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
              👤 {event.attendees!.slice(0, 2).map(a => a.name || a.email.split('@')[0]).join(', ')}
              {event.attendees!.length > 2 ? ` +${event.attendees!.length - 2}` : ''}
            </div>
          )}
        </>
      )}

      {/* Resize handle at bottom */}
      {resizable && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            cursor: 'ns-resize',
            background: hovered ? `${color}40` : 'transparent',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
            transition: 'background var(--transition-fast)',
          }}
        />
      )}
    </div>
    }
    />
  );
}

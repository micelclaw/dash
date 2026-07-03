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

import { EventBlock } from '../EventBlock';
import { WorkingHoursOverlay } from './WorkingHoursOverlay';
import { HOURS, ROW_HEIGHT, TOTAL_HEIGHT } from './grid-constants';
import type { CalendarEvent } from '../types';

/** Hour labels column on the left edge of the time grid */
export function TimeGutter() {
  return (
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
  );
}

interface DayColumnProps {
  colIndex: number;
  isLastColumn: boolean;
  today: boolean;
  /** Timed events belonging to this day */
  events: CalendarEvent[];
  /** Pixel offset of the current-time indicator (only rendered when today) */
  nowTop: number;
  dragPreview: { col: number; top: number; height: number } | null;
  dragEventId: string | null;
  resizingEventId: string | null;
  resizePreviewHeight: number | null;
  /** Whether drag/resize interactions are enabled (an onEventUpdate handler exists) */
  editable: boolean;
  onSlotClick: (colIndex: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onDragOver: (colIndex: number, e: React.DragEvent) => void;
  onDrop: (colIndex: number, e: React.DragEvent) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDelete?: (id: string) => void;
  onEventDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onResizeStart: (event: CalendarEvent, clientY: number) => void;
  calendarColorMap?: Record<string, string>;
}

/** One day column of the time grid: gridlines, now-indicator, drag ghost and event blocks */
export function DayColumn({
  colIndex,
  isLastColumn,
  today,
  events,
  nowTop,
  dragPreview,
  dragEventId,
  resizingEventId,
  resizePreviewHeight,
  editable,
  onSlotClick,
  onDragOver,
  onDrop,
  onEventClick,
  onEventDelete,
  onEventDragStart,
  onResizeStart,
  calendarColorMap,
}: DayColumnProps) {
  return (
    <div
      onClick={(e) => onSlotClick(colIndex, e)}
      onDragOver={(e) => onDragOver(colIndex, e)}
      onDrop={(e) => onDrop(colIndex, e)}
      style={{
        position: 'relative',
        borderRight: !isLastColumn ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
      }}
    >
      {/* Working hours highlight */}
      <WorkingHoursOverlay />

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
      {events.map((ev) => {
        const evStart = new Date(ev.start_at);
        const evEnd = ev.end_at ? new Date(ev.end_at) : new Date(evStart.getTime() + 60 * 60 * 1000);
        const startMin = evStart.getHours() * 60 + evStart.getMinutes();
        const endMin = evEnd.getHours() * 60 + evEnd.getMinutes();
        const durationMin = Math.max(endMin - startMin, 15);
        const top = (startMin / 1440) * TOTAL_HEIGHT;
        const height = (durationMin / 1440) * TOTAL_HEIGHT;

        // Apply resize preview height if this is the event being resized
        const isResizing = resizingEventId === ev.id;
        const blockHeight = isResizing && resizePreviewHeight != null
          ? resizePreviewHeight
          : Math.max(height, 20);

        const isDragging = dragEventId === ev.id;

        return (
          <EventBlock
            key={ev.id}
            event={ev}
            onClick={onEventClick}
            onDelete={() => onEventDelete?.(ev.id)}
            heightPx={blockHeight}
            draggable={editable}
            onDragStart={onEventDragStart}
            resizable={editable}
            onResizeStart={onResizeStart}
            calendarColorMap={calendarColorMap}
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
}

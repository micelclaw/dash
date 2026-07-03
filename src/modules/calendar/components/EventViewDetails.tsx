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

import { MapPin, Calendar, Users, Tag } from 'lucide-react';
import { TagChip } from '@/components/shared/TagChip';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { formatTime, formatDateLong } from '@/lib/date-helpers';
import { getCalendarColor } from '../types';
import type { CalendarEvent } from '../types';
import type { LinkedRecord } from '@/types/links';

interface EventViewDetailsProps {
  event: CalendarEvent;
  linkedRecords: LinkedRecord[];
  linkedRecordsLoading: boolean;
  onNavigate?: () => void;
}

/** Modo lectura del EventModal: detalles del evento + paneles de items relacionados */
export function EventViewDetails({
  event,
  linkedRecords,
  linkedRecordsLoading,
  onNavigate,
}: EventViewDetailsProps) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const color = getCalendarColor(event.calendar_name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Title */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
        {event.title}
      </h2>

      {/* Date / time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <Calendar size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text)' }}>
          {event.all_day
            ? formatDateLong(start)
            : `${formatDateLong(start)}, ${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`}
        </span>
      </div>

      {/* Location */}
      {event.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
          <MapPin size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{event.location}</span>
        </div>
      )}

      {/* Calendar badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--text-dim)' }}>{event.calendar_name}</span>
      </div>

      {/* Attendees */}
      {(event.attendees?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem' }}>
          <Users size={14} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {event.attendees!.map((a, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--surface)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  color: 'var(--text)',
                }}
              >
                {a.name || a.email}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {(event.tags?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem' }}>
          <Tag size={14} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {event.tags!.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text)',
            lineHeight: 1.5,
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {event.description}
        </div>
      )}

      {/* Related items */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <RelatedItemsPanel links={linkedRecords} loading={linkedRecordsLoading} onNavigate={onNavigate} sourceType="event" sourceId={event.id} />
        <SimilarContentPanel sourceType="event" sourceId={event.id} />
        <GraphProximityPanel sourceType="event" sourceId={event.id} />
      </div>
    </div>
  );
}

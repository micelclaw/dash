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

import { useState } from 'react';
import { MapPin, Calendar, Users, Tag, Share2, UserCircle2 } from 'lucide-react';
import { TagChip } from '@/components/shared/TagChip';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { SharedWithIndicator } from '@/components/shared/SharedWithIndicator';
import { useKeyboardOpen } from '@/hooks/use-media-query';
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareInitial, setShareInitial] = useState<'shared' | undefined>(undefined);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const isShared = !!event._shared;
  // Con el teclado desplegado (móvil), ocultar los paneles de inteligencia.
  const keyboardOpen = useKeyboardOpen();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Title + acción Compartir */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          {event.title}
        </h2>
        {!isShared && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <SharedWithIndicator
            entityType="event"
            entityId={event.id}
            refreshKey={shareRefreshKey}
            onManage={() => { setShareInitial('shared'); setShareOpen(true); }}
          />
          <button
            onClick={() => { setShareInitial(undefined); setShareOpen(true); }}
            title="Compartir"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer',
              color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
            }}
          >
            <Share2 size={13} /> Compartir
          </button>
          </div>
        )}
      </div>

      {/* Banner "Compartido por X" (evento que otro usuario me ha compartido) */}
      {isShared && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, var(--info) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)',
          fontSize: '0.8125rem',
        }}>
          <UserCircle2 size={15} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>
            Compartido por <strong>{event._shared_by_name || 'otro usuario'}</strong>
            {event._shared_permission === 'view' ? ' · solo lectura' : event._shared_permission === 'edit' ? ' · puedes editar' : ''}
          </span>
        </div>
      )}

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

      {/* Related items — ocultos con el teclado desplegado (móvil). */}
      {!keyboardOpen && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
          <RelatedItemsPanel links={linkedRecords} loading={linkedRecordsLoading} onNavigate={onNavigate} sourceType="event" sourceId={event.id} />
          <SimilarContentPanel sourceType="event" sourceId={event.id} />
          <GraphProximityPanel sourceType="event" sourceId={event.id} />
        </div>
      )}

      {shareOpen && (
        <EntityShareModal
          open={shareOpen}
          entityType="event"
          entityId={event.id}
          entityTitle={event.title}
          shareMeta={{ location: event.location ?? undefined }}
          initialSection={shareInitial}
          onShared={() => setShareRefreshKey(k => k + 1)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

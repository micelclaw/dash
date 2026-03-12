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
import type { Meeting } from '../types';

interface MeetingArchiveProps {
  meetings: Meeting[];
  onSelect: (id: string) => void;
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' \u2014 ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function statusLabel(status: Meeting['status']): string {
  switch (status) {
    case 'scheduled': return 'Scheduled';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
  }
}

function statusColor(status: Meeting['status']): string {
  switch (status) {
    case 'scheduled': return 'var(--text-dim)';
    case 'in_progress': return 'var(--amber)';
    case 'completed': return 'var(--success)';
  }
}

function statusBg(status: Meeting['status']): string {
  switch (status) {
    case 'scheduled': return 'var(--surface)';
    case 'in_progress': return 'var(--amber-dim)';
    case 'completed': return 'transparent';
  }
}

export function MeetingArchive({ meetings, onSelect }: MeetingArchiveProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (meetings.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        <span style={{ fontSize: '2rem' }}>🏛️</span>
        <span>No council meetings yet.</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Schedule your first meeting to get started.
        </span>
      </div>
    );
  }

  // Sort meetings: most recent first by created_at
  const sorted = [...meetings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div style={{
      overflowY: 'auto',
      height: '100%',
      padding: '16px 20px',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {sorted.map(meeting => {
          const isHovered = hoveredId === meeting.id;
          const dateStr = meeting.started_at ?? meeting.scheduled_at ?? meeting.created_at;

          // Build unique participant info from messages
          const participantMap = new Map<string, { name: string; avatar: string; color: string }>();
          for (const msg of meeting.messages) {
            if (!participantMap.has(msg.agent_id)) {
              participantMap.set(msg.agent_id, {
                name: msg.agent_name,
                avatar: msg.agent_avatar,
                color: msg.agent_color,
              });
            }
          }
          const participants = Array.from(participantMap.values());

          return (
            <div
              key={meeting.id}
              onClick={() => onSelect(meeting.id)}
              onMouseEnter={() => setHoveredId(meeting.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {/* Title row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 6,
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                }}>
                  {meeting.title}
                </h3>
                {meeting.status !== 'completed' && (
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: statusColor(meeting.status),
                    background: statusBg(meeting.status),
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    marginLeft: 12,
                  }}>
                    {statusLabel(meeting.status)}
                  </span>
                )}
              </div>

              {/* Date */}
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--text-dim)',
                marginBottom: 10,
              }}>
                {formatMeetingDate(dateStr)}
              </div>

              {/* Participant chips */}
              {participants.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                  {participants.map((p, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: p.color,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-full)',
                        padding: '2px 10px 2px 6px',
                      }}
                    >
                      <span>{p.avatar}</span>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary stats */}
              <div style={{
                display: 'flex',
                gap: 16,
                marginTop: 10,
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}>
                <span>{meeting.messages.length} message{meeting.messages.length !== 1 ? 's' : ''}</span>
                <span>{meeting.action_items.length} action item{meeting.action_items.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

import type { MeetingMessage as MeetingMessageType } from '../types';

interface MeetingMessageProps {
  message: MeetingMessageType;
}

export function MeetingMessage({ message }: MeetingMessageProps) {
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      borderLeft: `3px solid ${message.agent_color}`,
      padding: '14px 18px',
    }}>
      {/* Header: avatar + name + role + time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: '1rem' }}>
            {message.agent_avatar}
          </span>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: message.agent_color,
          }}>
            {message.agent_name}
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            background: 'var(--surface)',
            padding: '1px 8px',
            borderRadius: 'var(--radius-full)',
          }}>
            {message.agent_role}
          </span>
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
          marginLeft: 12,
        }}>
          {time}
        </span>
      </div>

      {/* Message body */}
      <div style={{
        fontSize: '0.875rem',
        lineHeight: 1.6,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
      </div>
    </div>
  );
}

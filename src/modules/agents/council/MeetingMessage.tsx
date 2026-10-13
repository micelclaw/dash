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

import { memo } from 'react';
import type { MeetingMessage as MeetingMessageType } from '../types';

interface MeetingMessageProps {
  message: MeetingMessageType;
}

// memo: durante el stream, cada delta crea un objeto `meeting`/`messages` nuevo pero deja intactas
// las referencias de los mensajes NO afectados (el handler solo hace {...x, content} en el que
// streamea). Con memo (comparación por referencia de `message`, el único prop) solo re-renderiza la
// burbuja que cambia, no las N del transcript → stream fluido en councils largos.
export const MeetingMessage = memo(function MeetingMessage({ message }: MeetingMessageProps) {
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={{
      background: 'var(--card)',
      // Longhand por lado: no mezclar `border` shorthand + `borderLeft` (React avisa
      // "Removing a style property during rerender (border)..." al cambiar agent_color).
      // Mismo patrón que el fix de AgentTreeNode.
      borderTop: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${message.agent_color}`,
      borderRadius: 'var(--radius-lg)',
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
        {message.streaming && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: '1em',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              background: message.agent_color,
              animation: 'meeting-cursor-blink 1s steps(2, start) infinite',
            }}
            aria-hidden
          />
        )}
      </div>
      {/* Inject the keyframes once — cheap; CSS dedupes via @keyframes name */}
      <style>{`
        @keyframes meeting-cursor-blink {
          to { visibility: hidden; }
        }
      `}</style>
    </div>
  );
});

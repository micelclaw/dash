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

import type { Message } from './types';
import { PLATFORMS } from './types';

interface MessageBubbleProps {
  message: Message;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isSent = message.direction === 'sent';
  const platformColor = PLATFORMS[message.platform]?.color ?? 'var(--amber)';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isSent ? 'flex-end' : 'flex-start',
      padding: '2px 16px',
    }}>
      <div style={{
        maxWidth: '70%',
        padding: '8px 12px',
        borderRadius: isSent ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isSent ? `${platformColor}22` : 'var(--surface)',
        border: `1px solid ${isSent ? `${platformColor}33` : 'var(--border)'}`,
      }}>
        {!isSent && message.sender_name && (
          <div style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: platformColor,
            marginBottom: 2,
          }}>
            {message.sender_name}
          </div>
        )}
        <div style={{
          fontSize: '0.8125rem',
          color: 'var(--text)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content || '(no content)'}
        </div>
        <div style={{
          fontSize: '0.625rem',
          color: 'var(--text-muted)',
          textAlign: isSent ? 'right' : 'left',
          marginTop: 4,
        }}>
          {formatTime(new Date(message.sent_at))}
        </div>
      </div>
    </div>
  );
}

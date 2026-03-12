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
import { Reply, ReplyAll, Forward } from 'lucide-react';
import { MailThreadMessage } from './MailThreadMessage';
import type { Email } from './types';

interface MailThreadProps {
  emails: Email[];
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}

export function MailThread({ emails, onReply, onReplyAll, onForward }: MailThreadProps) {
  const lastEmail = emails[emails.length - 1];
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(lastEmail ? [lastEmail.id] : []),
  );

  const toggleMessage = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Subject header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '12px 16px 8px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {lastEmail?.subject ?? '(no subject)'}
        </h2>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ({emails.length} messages)
        </span>
      </div>

      {/* Messages */}
      <div style={{ padding: '0 16px' }}>
        {emails.map((email, idx) => (
          <MailThreadMessage
            key={email.id}
            email={email}
            collapsed={!expandedIds.has(email.id)}
            onToggle={() => toggleMessage(email.id)}
            isLatest={idx === emails.length - 1}
          />
        ))}
      </div>

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          marginTop: 8,
        }}
      >
        <ActionButton icon={Reply} label="Reply" onClick={onReply} />
        <ActionButton icon={ReplyAll} label="Reply All" onClick={onReplyAll} />
        <ActionButton icon={Forward} label="Forward" onClick={onForward} />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

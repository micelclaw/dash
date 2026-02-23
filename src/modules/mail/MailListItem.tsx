import { useState, useRef } from 'react';
import {
  Star, Paperclip, Archive, Clock, Trash2,
  MailOpen, Mail as MailIcon, Inbox, ShieldAlert,
} from 'lucide-react';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { formatEmailTime } from '@/lib/date-helpers';
import type { Email } from './types';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';

interface MailListItemProps {
  email: Email;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onClick: () => void;
  accountColor?: string;
  onArchive: () => void;
  onDelete: () => void;
  onSnooze: (el: HTMLElement) => void;
  onToggleStar: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onMoveToFolder?: (folder: string) => void;
}

export function MailListItem({
  email,
  selected,
  active,
  onSelect,
  onClick,
  accountColor,
  onArchive,
  onDelete,
  onSnooze,
  onToggleStar,
  onMarkRead,
  onMarkUnread,
  onMoveToFolder,
}: MailListItemProps) {
  const [hovered, setHovered] = useState(false);
  const snoozeRef = useRef<HTMLButtonElement>(null);

  const unread = !email.is_read;
  const leftBorderColor = accountColor ?? 'var(--mod-mail)';

  const contextItems: ContextMenuItem[] = [
    {
      label: unread ? 'Mark as read' : 'Mark as unread',
      icon: unread ? MailOpen : MailIcon,
      onClick: () => unread ? onMarkRead?.() : onMarkUnread?.(),
    },
    {
      label: email.is_starred ? 'Unstar' : 'Star',
      icon: Star,
      onClick: onToggleStar,
    },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Archive', icon: Archive, onClick: onArchive },
    { label: 'Move to Inbox', icon: Inbox, onClick: () => onMoveToFolder?.('INBOX') },
    { label: 'Move to Spam', icon: ShieldAlert, onClick: () => onMoveToFolder?.('SPAM') },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const },
  ];

  return (
    <ContextMenu trigger={
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 12px',
        height: 68,
        boxSizing: 'border-box',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        borderLeft: unread ? `2px solid ${leftBorderColor}` : '2px solid transparent',
        background: active ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background var(--transition-fast)',
      }}
    >
      {/* Line 1: Checkbox + dot + from + time + attachment + star */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 14,
            height: 14,
            accentColor: 'var(--amber)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />

        {/* Account color dot */}
        {accountColor && (
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: accountColor,
              flexShrink: 0,
            }}
          />
        )}

        {/* From name */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: unread ? 600 : 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {email.from_name ?? email.from_address}
        </span>

        {/* Right-side: time + attachment + star (hidden when hover actions shown) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            opacity: hovered ? 0 : 1,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          {/* Time */}
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatEmailTime(email.received_at)}
          </span>

          {/* Attachment indicator */}
          {email.has_attachments && (
            <Paperclip size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}

          {/* Star */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: email.is_starred ? 'var(--amber)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Star
              size={14}
              fill={email.is_starred ? 'var(--amber)' : 'none'}
              strokeWidth={email.is_starred ? 0 : 1.5}
            />
          </button>
        </div>

        {/* Hover actions (overlaying timestamp area) */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity var(--transition-fast)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            title="Archive"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Archive size={14} />
          </button>
          <button
            ref={snoozeRef}
            onClick={(e) => {
              e.stopPropagation();
              if (snoozeRef.current) onSnooze(snoozeRef.current);
            }}
            title="Snooze"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Clock size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Line 2: Subject + preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          minWidth: 0,
          paddingLeft: 20,
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: unread ? 600 : 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {email.subject ?? '(no subject)'}
        </span>
        {email.body_plain && (
          <span
            style={{
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {' '}
            &mdash; {email.body_plain}
          </span>
        )}
      </div>

      {/* Line 3: Label chips */}
      {email.labels.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 20,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {email.labels.map((label) => (
            <span
              key={label}
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-dim)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
    } items={contextItems} />
  );
}

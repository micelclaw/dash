import { useState, useEffect, useRef } from 'react';
import { formatTime, formatDateLong } from '@/lib/date-helpers';
import { useIsMobile } from '@/hooks/use-media-query';
import type { EventCreateInput } from './types';

interface EventQuickCreateProps {
  date: Date;
  onClose: () => void;
  onCreate: (input: EventCreateInput) => Promise<unknown>;
}

export function EventQuickCreate({ date, onClose, onCreate }: EventQuickCreateProps) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Auto-focus on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const endDate = new Date(date.getTime() + 60 * 60 * 1000); // 1 hour duration

  const handleCreate = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        start_at: date.toISOString(),
        end_at: endDate.toISOString(),
        calendar_name: 'Personal',
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 'var(--z-modal-backdrop)' as unknown as number,
        }}
      />
      {/* Card */}
      <div
        style={{
          position: 'fixed',
          ...(isMobile
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(360px, 90vw)' }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 340 }),
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 'var(--z-modal)' as unknown as number,
          fontFamily: 'var(--font-sans)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Title input */}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Event title"
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Pre-filled date/time */}
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span>{formatDateLong(date)}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {formatTime(date)} - {formatTime(endDate)} (1 hr)
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8125rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || submitting}
            style={{
              padding: '6px 14px',
              background: title.trim() ? 'var(--amber)' : 'var(--surface)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              color: title.trim() ? '#06060a' : 'var(--text-muted)',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
}

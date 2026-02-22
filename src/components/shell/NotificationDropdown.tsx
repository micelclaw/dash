import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/stores/notification.store';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: NotificationDropdownProps) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 360,
        maxHeight: 420,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 'var(--z-dropdown)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          Notifications
        </span>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
            style={{
              fontSize: '0.6875rem',
              color: 'var(--amber)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No notifications
          </div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <NotificationItem key={n.id} notification={n} onClose={onClose} />
          ))
        )}
      </div>
    </div>
  );
}

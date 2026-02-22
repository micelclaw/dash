import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/stores/notification.store';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [bounce, setBounce] = useState(false);
  const prevCount = useRef(unreadCount);

  // Bounce animation when new notification arrives
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 300);
      prevCount.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-dim)',
          padding: 6,
          display: 'flex',
          borderRadius: 'var(--radius-md)',
          transition: 'background var(--transition-fast)',
          transform: bounce ? 'scale(1.2)' : 'scale(1)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--amber)',
              color: '#06060a',
              fontSize: '0.5625rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationDropdown open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

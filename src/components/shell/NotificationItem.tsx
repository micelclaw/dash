import { useNavigate } from 'react-router';
import { RefreshCw, Bot, Mail, BarChart3, AlertTriangle, ShieldCheck, Zap, Calendar, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Notification } from '@/types/notifications';
import { useNotificationStore } from '@/stores/notification.store';
import { useDigestStore } from '@/stores/digest.store';

const TYPE_ICONS: Record<Notification['type'], LucideIcon> = {
  sync: RefreshCw,
  agent_action: Bot,
  email: Mail,
  calendar: Calendar,
  contacts: Users,
  digest: BarChart3,
  system: AlertTriangle,
  approval: ShieldCheck,
  change: Zap,
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  sync: 'var(--info)',
  agent_action: 'var(--mod-agents)',
  email: 'var(--mod-mail)',
  calendar: 'var(--mod-calendar)',
  contacts: 'var(--mod-contacts)',
  digest: 'var(--mod-chat)',
  system: 'var(--warning)',
  approval: 'var(--error)',
  change: 'var(--success)',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  const Icon = TYPE_ICONS[notification.type];
  const iconColor = notification.color ?? TYPE_COLORS[notification.type];

  const dispatchAction = () => {
    if (notification.action?.callback === 'openBriefing') {
      useDigestStore.getState().setPanelOpen(true);
      onClose();
      return true;
    }
    if (notification.action?.route) {
      navigate(notification.action.route);
      onClose();
      return true;
    }
    return false;
  };

  const handleClick = () => {
    markAsRead(notification.id);
    dispatchAction();
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(notification.id);
    dispatchAction();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        cursor: (notification.action?.route || notification.action?.callback) ? 'pointer' : 'default',
        borderLeft: notification.read ? '2px solid transparent' : '2px solid var(--amber)',
        opacity: notification.read ? 0.6 : 1,
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.4 }}>
          {notification.title}
        </div>
        {notification.body && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>
            {notification.body}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {timeAgo(notification.timestamp)}
          </span>
          {notification.action && (
            <button
              onClick={handleActionClick}
              style={{
                fontSize: '0.6875rem',
                color: 'var(--amber)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber-dim)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

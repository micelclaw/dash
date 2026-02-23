import { create } from 'zustand';
import type { Notification } from '@/types/notifications';

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1', type: 'email', title: '3 new emails received',
    body: 'From Juan López, María García', read: false,
    timestamp: minutesAgo(2), action: { label: 'Open', route: '/mail' },
  },
  {
    id: 'notif-2', type: 'sync', title: 'Sync completed',
    body: 'Google Calendar — 12 events synced', read: false,
    timestamp: minutesAgo(15), action: { label: 'View', route: '/calendar' },
  },
  {
    id: 'notif-3', type: 'agent_action', title: 'Agent action completed',
    body: 'Francis created note "Weekly Report"', read: false,
    timestamp: minutesAgo(60), action: { label: 'View', route: '/notes?id=note-weekly' },
  },
  {
    id: 'notif-4', type: 'system', title: 'System alert',
    body: 'Disk usage at 85%', read: true,
    timestamp: minutesAgo(180),
  },
  {
    id: 'notif-5', type: 'digest', title: 'Upcoming: Team Standup',
    body: 'In 15 minutes · Room 3', read: true,
    timestamp: minutesAgo(240), action: { label: 'View', route: '/calendar' },
  },
];

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (n: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: MOCK_NOTIFICATIONS,
  unreadCount: MOCK_NOTIFICATIONS.filter((n) => !n.read).length,

  addNotification: (n) =>
    set((state) => {
      const notification: Notification = {
        ...n,
        id: crypto.randomUUID(),
        read: false,
        timestamp: new Date().toISOString(),
      };
      const notifications = [notification, ...state.notifications].slice(0, 50);
      return {
        notifications,
        unreadCount: notifications.filter((x) => !x.read).length,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((x) => !x.read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

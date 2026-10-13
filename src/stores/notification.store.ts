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

import { create } from 'zustand';
import type { Notification } from '@/types/notifications';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (n: Omit<Notification, 'id' | 'read' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  /** Retira las notificaciones sobre un registro que dejó de ser accionable. */
  removeByRef: (kind: string, id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((state) => {
      const now = Date.now();
      // Con `id` (frames del servidor `notification.new`): dedupe IDEMPOTENTE por id
      // → reconexión / multi-pestaña / backfill no duplican, y los críticos siempre
      // se pintan (el id del evento es estable). Sin `id` (síntesis cliente-side de
      // sync/email/digest): ventana anti-spam de 30 min por title+type.
      if (n.id) {
        if (state.notifications.some((x) => x.id === n.id)) return state;
      } else {
        const DEDUP_WINDOW = 30 * 60_000;
        const isDuplicate = state.notifications.some(
          (existing) =>
            existing.title === n.title &&
            existing.type === n.type &&
            now - new Date(existing.timestamp).getTime() < DEDUP_WINDOW,
        );
        if (isDuplicate) return state;
      }

      const notification: Notification = {
        ...n,
        id: n.id ?? crypto.randomUUID(),
        read: false,
        timestamp: n.timestamp ?? new Date().toISOString(),
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

  // Lo dispara `notification.dismiss` del servidor (o el propio ✓/✗, optimista). Puede
  // haber varias notificaciones del mismo registro (reintentos, escalado) → se van todas.
  removeByRef: (kind, id) =>
    set((state) => {
      const notifications = state.notifications.filter(
        (n) => !(n.ref?.kind === kind && n.ref?.id === id),
      );
      if (notifications.length === state.notifications.length) return state;
      return { notifications, unreadCount: notifications.filter((x) => !x.read).length };
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

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

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores/notification.store';
import type { Meeting } from '../../types';

interface CreateMeetingPayload {
  title: string;
  description?: string;
  participants: string[];
  user_participates: boolean;
  scheduled_at?: string | null;
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data: Meeting[] }>('/meetings');
        if (!cancelled) {
          setMeetings(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          addNotification({
            type: 'system',
            title: 'Failed to load meetings',
            body: err instanceof Error ? err.message : 'Unknown error',
          });
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [addNotification]);

  const createMeeting = useCallback(async (payload: CreateMeetingPayload): Promise<Meeting | null> => {
    try {
      const res = await api.post<{ data: Meeting }>('/meetings', payload);
      setMeetings(prev => [res.data, ...prev]);
      addNotification({
        type: 'system',
        title: 'Meeting created',
        body: `"${res.data.title}" has been scheduled.`,
      });
      return res.data;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to create meeting',
        body: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }, [addNotification]);

  return { meetings, loading, createMeeting };
}

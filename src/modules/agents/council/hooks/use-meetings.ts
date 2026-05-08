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
import { useWebSocket } from '@/hooks/use-websocket';
import type { Meeting, MeetingMessage, ActionItem } from '../../types';

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

  const updateMeeting = useCallback(async (id: string, patch: Partial<Meeting>): Promise<Meeting | null> => {
    try {
      const res = await api.patch<{ data: Meeting }>(`/meetings/${id}`, patch);
      setMeetings(prev => prev.map(m => (m.id === id ? res.data : m)));
      return res.data;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to update meeting',
        body: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }, [addNotification]);

  const runMeeting = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.post<{ data: { running: boolean; id: string; started_at: string } }>(`/meetings/${id}/run`, {});
      // Optimistic update so the UI flips to in_progress immediately
      setMeetings(prev => prev.map(m => m.id === id
        ? { ...m, status: 'in_progress', started_at: res.data.started_at }
        : m));
      addNotification({
        type: 'system',
        title: 'Council started',
        body: 'Agents are debating now. Messages will appear in real time.',
      });
      return true;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to start council',
        body: err instanceof Error ? err.message : 'Unknown error',
      });
      return false;
    }
  }, [addNotification]);

  const endMeeting = useCallback((id: string) => {
    return updateMeeting(id, { status: 'completed', completed_at: new Date().toISOString() } as Partial<Meeting>);
  }, [updateMeeting]);

  /**
   * Edit a scheduled meeting's content fields. Sends UUID strings for
   * participants (the BE accepts string[] on PATCH; the response comes
   * back enriched with display_name/avatar/role/color).
   */
  const editMeeting = useCallback(async (id: string, payload: {
    title: string;
    description: string | null;
    participants: string[];
    user_participates: boolean;
    scheduled_at: string | null;
  }): Promise<Meeting | null> => {
    try {
      const res = await api.patch<{ data: Meeting }>(`/meetings/${id}`, payload);
      setMeetings(prev => prev.map(m => (m.id === id ? res.data : m)));
      return res.data;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to save meeting',
        body: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }, [addNotification]);

  const archiveMeeting = useCallback((id: string) => {
    return updateMeeting(id, { status: 'archived' } as Partial<Meeting>);
  }, [updateMeeting]);

  const unarchiveMeeting = useCallback((id: string) => {
    return updateMeeting(id, { status: 'completed' } as Partial<Meeting>);
  }, [updateMeeting]);

  const deleteMeeting = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/meetings/${id}`);
      setMeetings(prev => prev.filter(m => m.id !== id));
      return true;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to delete meeting',
        body: err instanceof Error ? err.message : 'Unknown error',
      });
      return false;
    }
  }, [addNotification]);

  // ── Live updates from the orchestrator ─────────────────────────────
  // The Core meeting-orchestrator broadcasts each agent turn as it lands.
  const messageEv = useWebSocket('meeting.message.added');
  useEffect(() => {
    if (!messageEv) return;
    const data = messageEv.data as { meeting_id?: string; message?: MeetingMessage } | undefined;
    if (!data) return;
    const id = data.meeting_id;
    const msg = data.message;
    if (!id || !msg) return;
    setMeetings(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.messages.some(x => x.id === msg.id)) return m;
      return { ...m, messages: [...m.messages, msg] };
    }));
  }, [messageEv]);

  const completedEv = useWebSocket('meeting.completed');
  useEffect(() => {
    if (!completedEv) return;
    const data = completedEv.data as { meeting_id?: string; action_items?: ActionItem[] } | undefined;
    if (!data) return;
    const id = data.meeting_id;
    const items = data.action_items ?? [];
    if (!id) return;
    setMeetings(prev => prev.map(m =>
      m.id === id
        ? { ...m, status: 'completed', completed_at: new Date().toISOString(), action_items: items }
        : m
    ));
  }, [completedEv]);

  return {
    meetings,
    loading,
    createMeeting,
    editMeeting,
    runMeeting,
    endMeeting,
    archiveMeeting,
    unarchiveMeeting,
    deleteMeeting,
  };
}

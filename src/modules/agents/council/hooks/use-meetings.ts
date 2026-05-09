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
import type { Meeting, MeetingMessage, ActionItem, MeetingAdvancedOptions } from '../../types';

interface CreateMeetingPayload {
  title: string;
  description?: string;
  participants: string[];
  user_participates: boolean;
  scheduled_at?: string | null;
  advanced_options?: MeetingAdvancedOptions;
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

  // ── Recovery polling ───────────────────────────────────────────────
  // WS broadcasts can drop momentarily during a long orchestration
  // (~10s reconnect window in the WS client) and miss a meeting.message
  // event, leaving the dash a turn behind the DB. While ANY meeting is
  // in_progress, refetch the list every 5s so the missed messages
  // catch up. Polling stops once no meeting is running.
  const hasRunning = meetings.some(m => m.status === 'in_progress');
  useEffect(() => {
    if (!hasRunning) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ data: Meeting[] }>('/meetings');
        if (cancelled) return;
        setMeetings(prev => {
          // Merge fresh messages into local state without losing pending
          // optimistic updates. For each meeting we keep the longer of
          // the two message arrays — covers both cases (local has more
          // because of WS, server has more because of dropped WS).
          const byId = new Map(prev.map(m => [m.id, m]));
          for (const fresh of res.data) {
            const local = byId.get(fresh.id);
            if (!local) { byId.set(fresh.id, fresh); continue; }
            const merged: Meeting = {
              ...fresh,
              messages: fresh.messages.length >= local.messages.length ? fresh.messages : local.messages,
            };
            byId.set(fresh.id, merged);
          }
          return Array.from(byId.values());
        });
      } catch { /* swallow — next tick will retry */ }
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [hasRunning]);

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
    advanced_options?: MeetingAdvancedOptions;
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

  /**
   * Wipe generated content (messages + action items) and return the
   * meeting to scheduled. The user can then edit advanced options and
   * re-run.
   */
  const resetMeeting = useCallback(async (id: string): Promise<Meeting | null> => {
    try {
      const res = await api.post<{ data: Meeting }>(`/meetings/${id}/reset`, {});
      setMeetings(prev => prev.map(m => (m.id === id ? res.data : m)));
      return res.data;
    } catch (err) {
      addNotification({
        type: 'system',
        title: 'Failed to reset meeting',
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
  // The orchestrator emits three events per turn:
  //   meeting.message.start  → append placeholder with streaming: true
  //   meeting.message.delta  → update content as tokens stream in
  //   meeting.message.added  → replace placeholder with persisted message
  //                            (idempotent — same id, streaming: false)

  const startEv = useWebSocket('meeting.message.start');
  useEffect(() => {
    if (!startEv) return;
    const data = startEv.data as { meeting_id?: string; message?: MeetingMessage } | undefined;
    if (!data?.meeting_id || !data.message) return;
    const id = data.meeting_id;
    const msg: MeetingMessage = { ...data.message, streaming: true };
    setMeetings(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.messages.some(x => x.id === msg.id)) return m;
      return { ...m, messages: [...m.messages, msg] };
    }));
  }, [startEv]);

  const deltaEv = useWebSocket('meeting.message.delta');
  useEffect(() => {
    if (!deltaEv) return;
    const data = deltaEv.data as { meeting_id?: string; message_id?: string; content?: string } | undefined;
    if (!data?.meeting_id || !data.message_id || data.content === undefined) return;
    const meetingId = data.meeting_id;
    const messageId = data.message_id;
    const content = data.content;
    setMeetings(prev => prev.map(m => {
      if (m.id !== meetingId) return m;
      let found = false;
      const messages = m.messages.map(x => {
        if (x.id !== messageId) return x;
        found = true;
        return { ...x, content };
      });
      return found ? { ...m, messages } : m;
    }));
  }, [deltaEv]);

  const messageEv = useWebSocket('meeting.message.added');
  useEffect(() => {
    if (!messageEv) return;
    const data = messageEv.data as { meeting_id?: string; message?: MeetingMessage } | undefined;
    if (!data?.meeting_id || !data.message) return;
    const id = data.meeting_id;
    const finalMsg: MeetingMessage = { ...data.message, streaming: false };
    setMeetings(prev => prev.map(m => {
      if (m.id !== id) return m;
      // Replace placeholder with the final persisted message (same id)
      let found = false;
      const messages = m.messages.map(x => {
        if (x.id !== finalMsg.id) return x;
        found = true;
        return finalMsg;
      });
      return found ? { ...m, messages } : { ...m, messages: [...m.messages, finalMsg] };
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
    resetMeeting,
    deleteMeeting,
  };
}

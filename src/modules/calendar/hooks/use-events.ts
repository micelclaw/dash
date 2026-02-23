import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/services/api';
import { useRealtimeList } from '@/hooks/use-realtime-list';
import { toast } from 'sonner';
import type { CalendarEvent, EventCreateInput, EventUpdateInput, CalendarView } from '../types';
import type { ApiListResponse, ApiResponse } from '@/types/api';
import { getDateRange } from '@/lib/date-helpers';

export function useEvents(params: {
  view: CalendarView;
  currentDate: Date;
  calendarName?: string;
  search?: string;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = getDateRange(params.view, params.currentDate);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<CalendarEvent>>('/events', {
        from: range.from,
        to: range.to,
        calendar_name: params.calendarName || undefined,
        search: params.search || undefined,
        limit: 200,
        sort: 'start_at',
        order: 'asc',
      });
      setEvents(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, params.calendarName, params.search]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useRealtimeList('event', events, setEvents);

  const createEvent = async (input: EventCreateInput): Promise<CalendarEvent> => {
    const res = await api.post<ApiResponse<CalendarEvent>>('/events', input);
    setEvents(prev => [...prev, res.data].sort((a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    ));
    toast('Event created');
    return res.data;
  };

  const updateEvent = async (id: string, input: EventUpdateInput): Promise<CalendarEvent> => {
    // Optimistic update
    const prev = events.find(e => e.id === id);
    if (prev) {
      setEvents(evts => evts.map(e => e.id === id ? { ...e, ...input, updated_at: new Date().toISOString() } as CalendarEvent : e));
    }
    try {
      const res = await api.patch<ApiResponse<CalendarEvent>>(`/events/${id}`, input);
      setEvents(evts => evts.map(e => e.id === id ? res.data : e));
      return res.data;
    } catch {
      if (prev) setEvents(evts => evts.map(e => e.id === id ? prev : e));
      toast.error('Failed to update event');
      throw new Error('Failed to update event');
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    const removed = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    try {
      await api.delete(`/events/${id}`);
      toast('Event deleted', {
        action: removed ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post(`/events/${id}/restore`);
              if (removed) setEvents(prev => [...prev, removed].sort((a, b) => a.start_at.localeCompare(b.start_at)));
            } catch { toast.error('Failed to restore event'); }
          },
        } : undefined,
      });
    } catch {
      if (removed) setEvents(prev => [...prev, removed]);
      toast.error('Failed to delete event');
    }
  };

  return { events, loading, error, fetchEvents, createEvent, updateEvent, deleteEvent };
}

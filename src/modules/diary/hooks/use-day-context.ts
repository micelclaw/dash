import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { ApiListResponse } from '@/types/api';

interface DayContext {
  events: { id: string; title: string; start_at: string }[];
  notes: { id: string; title: string | null }[];
  emailCount: number;
}

export function useDayContext(entryDate: string | null): DayContext | null {
  const [context, setContext] = useState<DayContext | null>(null);

  useEffect(() => {
    if (!entryDate) { setContext(null); return; }

    Promise.all([
      api.get<ApiListResponse<{ id: string; title: string; start_at: string }>>('/events', {
        from: `${entryDate}T00:00:00`,
        to: `${entryDate}T23:59:59`,
        limit: 10,
      }),
      api.get<ApiListResponse<{ id: string; title: string | null; created_at: string }>>('/notes', {
        sort: 'created_at',
        order: 'desc',
        limit: 20,
      }),
    ])
      .then(([events, notes]) => {
        setContext({
          events: events.data,
          notes: notes.data.filter(n => n.created_at?.startsWith(entryDate)),
          emailCount: 0, // TODO: get from API when email module is available
        });
      })
      .catch(() => setContext(null));
  }, [entryDate]);

  return context;
}

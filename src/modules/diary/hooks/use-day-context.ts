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

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { ApiListResponse } from '@/types/api';

interface MessageSummary {
  platform: string;
  count: number;
}

interface DayContext {
  events: { id: string; title: string; start_at: string }[];
  notes: { id: string; title: string | null }[];
  emailCount: number;
  photoCount: number;
  messages: MessageSummary[];
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
      api.get<ApiListResponse<{ id: string }>>('/photos/timeline', {
        from: entryDate,
        to: entryDate,
        limit: 1,
      }),
      api.get<ApiListResponse<{ id: string; platform: string; direction: string; sender_name: string; content: string | null; sent_at: string }>>('/messages', {
        since: `${entryDate}T00:00:00`,
        until: `${entryDate}T23:59:59`,
        limit: 100,
      }),
    ])
      .then(([events, notes, photos, msgs]) => {
        // Group messages by platform
        const platformCounts = new Map<string, number>();
        for (const m of msgs.data) {
          platformCounts.set(m.platform, (platformCounts.get(m.platform) ?? 0) + 1);
        }
        const messages: MessageSummary[] = [...platformCounts.entries()]
          .map(([platform, count]) => ({ platform, count }));

        setContext({
          events: events.data,
          notes: notes.data.filter(n => n.created_at?.startsWith(entryDate)),
          emailCount: 0, // TODO: get from API when email module is available
          photoCount: (photos as any).meta?.total ?? photos.data.length,
          messages,
        });
      })
      .catch(() => setContext(null));
  }, [entryDate]);

  return context;
}

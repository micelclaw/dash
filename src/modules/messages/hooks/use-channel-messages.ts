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
import type { ApiListResponse } from '@/types/api';
import type { Message } from '../types';

const PAGE_SIZE = 50;

export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetch = useCallback(async () => {
    if (!channelId) { setMessages([]); return; }
    setLoading(true);
    try {
      const res = await api.get<ApiListResponse<Message>>('/messages', {
        channel_id: channelId,
        sort: 'sent_at',
        order: 'asc',
        limit: String(PAGE_SIZE),
      });
      setMessages(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { fetch(); }, [fetch]);

  const hasMore = messages.length < total;

  const loadMore = useCallback(async () => {
    if (!channelId || !hasMore) return;
    try {
      const res = await api.get<ApiListResponse<Message>>('/messages', {
        channel_id: channelId,
        sort: 'sent_at',
        order: 'asc',
        limit: String(PAGE_SIZE),
        offset: String(messages.length),
      });
      setMessages(prev => [...res.data, ...prev]);
    } catch {
      // ignore
    }
  }, [channelId, hasMore, messages.length]);

  // Allow appending a new message (for optimistic send)
  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
    setTotal(prev => prev + 1);
  }, []);

  return { messages, loading, hasMore, loadMore, refetch: fetch, appendMessage };
}

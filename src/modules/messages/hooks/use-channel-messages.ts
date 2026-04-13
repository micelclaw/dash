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

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import type { ApiListResponse } from '@/types/api';
import type { Message } from '../types';

const PAGE_SIZE = 50;

export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDone = useRef(false);

  const fetch = useCallback(async (isPolling = false) => {
    if (!channelId) { setMessages([]); return; }

    // Cancel any in-flight request — only the latest fetch wins
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Only show loading spinner on initial load, not on polling/refetch
    if (!isPolling && !initialLoadDone.current) setLoading(true);

    try {
      const res = await api.get<ApiListResponse<Message>>('/messages', {
        channel_id: channelId,
        sort: 'sent_at',
        order: 'desc',
        limit: String(PAGE_SIZE),
      });

      // If this request was aborted, a newer one is in flight — discard
      if (controller.signal.aborted) return;

      setMessages(res.data.reverse());
      setTotal(res.meta?.total ?? res.data.length);
      initialLoadDone.current = true;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      console.warn('[messages] fetch failed:', err?.message ?? err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    initialLoadDone.current = false;
    fetch();
    return () => { abortRef.current?.abort(); };
  }, [fetch]);

  const hasMore = messages.length < total;

  const loadMore = useCallback(async () => {
    if (!channelId || !hasMore) return;
    try {
      const res = await api.get<ApiListResponse<Message>>('/messages', {
        channel_id: channelId,
        sort: 'sent_at',
        order: 'desc',
        limit: String(PAGE_SIZE),
        offset: String(messages.length),
      });
      setMessages(prev => [...res.data.reverse(), ...prev]);
    } catch {
      // ignore
    }
  }, [channelId, hasMore, messages.length]);

  // Allow appending a new message (for optimistic send)
  const appendMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
    setTotal(prev => prev + 1);
  }, []);

  // Refetch wrapper that marks as polling (no loading spinner)
  const refetch = useCallback(() => fetch(true), [fetch]);

  return { messages, loading, hasMore, loadMore, refetch, appendMessage };
}

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
import type { AgentEventRow, AgentEventsResponse } from '../types';

/** Timeline de eventos del agente (GET /managed-agents/:id/events) con paginación por cursor. */
export function useAgentEvents(agentId: string | null, severity = 'all') {
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (id: string, before?: string) => {
    const params = new URLSearchParams();
    if (severity && severity !== 'all') params.set('severity', severity);
    if (before) params.set('before', before);
    const res = await api.get<{ data: AgentEventsResponse }>(`/managed-agents/${id}/events?${params}`);
    return res.data;
  }, [severity]);

  useEffect(() => {
    if (!agentId) { setEvents([]); setHasMore(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(agentId)
      .then((d) => { if (!cancelled) { setEvents(d.events); setHasMore(d.has_more); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los eventos'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!agentId || loadingMore || events.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = events[events.length - 1]?.created_at;
      const d = await fetchPage(agentId, cursor);
      setEvents((prev) => [...prev, ...d.events]);
      setHasMore(d.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar más eventos');
    } finally {
      setLoadingMore(false);
    }
  }, [agentId, events, loadingMore, fetchPage]);

  return { events, loading, loadingMore, error, hasMore, loadMore };
}

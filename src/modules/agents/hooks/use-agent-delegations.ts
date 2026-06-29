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
import type { AgentDelegation, DelegationSession, AgentDelegationsResponse } from '../types';

/** Delegaciones del agente (GET /managed-agents/:id/delegations) con paginación por cursor. */
export function useAgentDelegations(agentId: string | null, direction?: 'incoming' | 'outgoing') {
  const [delegations, setDelegations] = useState<AgentDelegation[]>([]);
  const [bySession, setBySession] = useState<DelegationSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (id: string, before?: string) => {
    const params = new URLSearchParams();
    if (direction) params.set('direction', direction);
    if (before) params.set('before', before);
    const res = await api.get<{ data: AgentDelegationsResponse }>(`/managed-agents/${id}/delegations?${params}`);
    return res.data;
  }, [direction]);

  useEffect(() => {
    if (!agentId) { setDelegations([]); setBySession([]); setHasMore(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(agentId)
      .then((d) => { if (!cancelled) { setDelegations(d.delegations); setBySession(d.by_session); setHasMore(d.has_more); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las delegaciones'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!agentId || loadingMore || delegations.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = delegations[delegations.length - 1]?.created_at;
      const d = await fetchPage(agentId, cursor);
      setDelegations((prev) => [...prev, ...d.delegations]);
      setHasMore(d.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar más delegaciones');
    } finally {
      setLoadingMore(false);
    }
  }, [agentId, delegations, loadingMore, fetchPage]);

  return { delegations, bySession, loading, loadingMore, error, hasMore, loadMore };
}

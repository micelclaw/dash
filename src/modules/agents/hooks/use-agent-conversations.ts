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
import { useAuthStore } from '@/stores/auth.store';
import type { AgentConversation, ConversationStats } from '../types';

interface UseAgentConversationsParams {
  period: string;
  agent?: string;
  query?: string;
}

type ConversationRead =
  | { kind: 'loaded'; conversations: AgentConversation[]; stats: ConversationStats | null }
  | { kind: 'error' };

export function useAgentConversations({ period, agent, query }: UseAgentConversationsParams) {
  const [request, setRequest] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: ConversationRead }>();
  const sessionGeneration = useAuthStore(state => state.sessionGeneration);
  const key = JSON.stringify([sessionGeneration, period, agent, query, request]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const isCurrent = () => !signal.aborted && useAuthStore.getState().sessionGeneration === sessionGeneration;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (agent) params.set('participant', agent);
        if (period) params.set('period', period);
        if (query) params.set('q', query);
        const [convRes, statsRes] = await Promise.all([
          api.get<{ data: AgentConversation[] }>(`/conversations?${params}`, undefined, { signal }),
          api.get<{ data: ConversationStats | null }>(`/conversations/stats?${params}`, undefined, { signal }),
        ]);
        if (isCurrent()) {
          setSettled({ key, result: { kind: 'loaded', conversations: convRes.data, stats: statsRes.data } });
        }
      } catch {
        if (isCurrent()) setSettled({ key, result: { kind: 'error' } });
      }
    }
    void load();
    return () => controller.abort();
  }, [period, agent, query, key, sessionGeneration]);

  const current = settled?.key === key ? settled.result : undefined;
  return {
    conversations: current?.kind === 'loaded' ? current.conversations : [],
    stats: current?.kind === 'loaded' ? current.stats : null,
    loading: !current,
    failed: current?.kind === 'error',
    retry: () => setRequest(value => value + 1),
  };
}

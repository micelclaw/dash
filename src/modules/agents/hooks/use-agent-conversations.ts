import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { AgentConversation, ConversationStats } from '../types';

interface UseAgentConversationsParams {
  period: string;
  agent?: string;
}

export function useAgentConversations({ period, agent }: UseAgentConversationsParams) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (agent) params.set('agent', agent);
        const [convRes, statsRes] = await Promise.all([
          api.get<{ data: AgentConversation[] }>(`/agent-conversations?${params}`),
          api.get<{ data: ConversationStats }>('/agent-conversations/stats'),
        ]);
        if (!cancelled) {
          setConversations(convRes.data);
          setStats(statsRes.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period, agent]);

  return { conversations, stats, loading };
}

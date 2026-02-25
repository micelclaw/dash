import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ManagedAgent } from '../types';

export function useAgents() {
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: ManagedAgent[] }>('/managed-agents');
      setAgents(res.data);
      setLoading(false);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setAgents([]);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAgent = (agent: ManagedAgent) => {
    setAgents(prev => [...prev, agent]);
  };

  const refetch = useCallback(() => { load(); }, [load]);

  return { agents, loading, error, addAgent, refetch };
}

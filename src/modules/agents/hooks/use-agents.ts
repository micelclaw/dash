import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { ManagedAgent } from '../types';

export function useAgents() {
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ data: ManagedAgent[] }>('/managed-agents');
        if (!cancelled) {
          setAgents(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load agents');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const addAgent = (agent: ManagedAgent) => {
    setAgents(prev => [...prev, agent]);
  };

  return { agents, loading, error, addAgent };
}

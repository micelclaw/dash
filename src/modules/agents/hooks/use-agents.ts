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

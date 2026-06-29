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
import type { AgentHealth } from '../types';

/** Carga el diagnóstico de salud de un agente (GET /managed-agents/:id/health). Solo lectura. */
export function useAgentHealth(agentId: string | null) {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AgentHealth }>(`/managed-agents/${id}/health`);
      setHealth(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!agentId) { setHealth(null); return; }
    let cancelled = false;
    setHealth(null);
    load(agentId).then(() => { if (cancelled) setHealth(null); });
    return () => { cancelled = true; };
  }, [agentId, load]);

  const refetch = useCallback(() => { if (agentId) load(agentId); }, [agentId, load]);

  return { health, loading, error, refetch };
}

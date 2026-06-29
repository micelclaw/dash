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
import type { AgentAnalytics } from '../types';

/** Analítica agregada de la flota (GET /managed-agents/analytics?period=). Solo lectura. */
export function useAgentAnalytics(period: '7d' | '30d') {
  const [analytics, setAnalytics] = useState<AgentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AgentAnalytics }>(`/managed-agents/analytics?period=${period}`);
      if (!signal?.cancelled) setAnalytics(res.data);
    } catch (err) {
      if (!signal?.cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la analítica');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchAnalytics(signal);
    return () => { signal.cancelled = true; };
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: () => fetchAnalytics() };
}

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
import type { AgentLiveInfo } from '../types';

/**
 * Carga la actividad en vivo de un agente (`GET /managed-agents/:id/live-info`).
 * Solo lectura: sin escrituras de config → no toca el rate-limit del Gateway.
 * Expone estados explícitos de loading/error para que la tarjeta pinte
 * skeletons y errores con detalle (no `catch {}` silencioso).
 */
export function useAgentLiveInfo(agentId: string | null) {
  const [info, setInfo] = useState<AgentLiveInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AgentLiveInfo }>(`/managed-agents/${id}/live-info`);
      setInfo(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!agentId) { setInfo(null); return; }
    let cancelled = false;
    setInfo(null);
    load(agentId).then(() => { if (cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [agentId, load]);

  const refetch = useCallback(() => {
    if (agentId) load(agentId);
  }, [agentId, load]);

  return { info, loading, error, refetch };
}

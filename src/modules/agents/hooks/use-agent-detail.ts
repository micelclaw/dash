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
import { useWebSocket } from '@/hooks/use-websocket';
import type { ManagedAgent } from '../types';

export function useAgentDetail(agentId: string | null) {
  const [agent, setAgent] = useState<ManagedAgent | null>(null);
  // Arranca en `true` si ya hay un agente que pedir: el effect que hace el fetch
  // corre DESPUÉS del primer paint, así que con `false` el consumidor pintaba un
  // frame de "Agent not found" al montar el panel (ficha AB8, medido: 1 frame a
  // los 52 ms del click). Con selección previa el hueco lo tapa el agente viejo.
  const [loading, setLoading] = useState(agentId !== null);

  // `isCancelled` evita la race de StrictMode (doble-invoke): la carga del primer
  // effect (ya cancelado) NO debe pisar el agente que el segundo effect cargó.
  const load = useCallback(async (id: string, isCancelled?: () => boolean) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ManagedAgent }>(`/managed-agents/${id}`);
      if (!isCancelled?.()) setAgent(res.data);
    } catch { /* ignore */ }
    finally { if (!isCancelled?.()) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!agentId) { setAgent(null); setLoading(false); return; }
    let cancelled = false;
    void load(agentId, () => cancelled);
    return () => { cancelled = true; };
  }, [agentId, load]);

  // Cross-tab invalidation: when another dash tab changes this agent's
  // model via set-model, the backend broadcasts agent.model_changed via
  // WebSocket. Refetch so this tab reflects the change without a reload.
  const modelChangedEvent = useWebSocket('agent.model_changed');
  useEffect(() => {
    if (!modelChangedEvent || !agentId) return;
    const changedId = modelChangedEvent.data?.agent_id as string | undefined;
    if (changedId === agentId) {
      load(agentId);
    }
  }, [modelChangedEvent, agentId, load]);

  const refetch = useCallback(() => {
    if (agentId) load(agentId);
  }, [agentId, load]);

  return { agent, loading, refetch };
}

export function useAgentFile(agentId: string | null, filename: string) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) { setContent(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<{ data: { content: string } }>(
          `/managed-agents/${agentId}/workspace-file?path=${encodeURIComponent(filename)}`
        );
        if (!cancelled) {
          setContent(res.data.content);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [agentId, filename]);

  const save = async (newContent: string) => {
    if (!agentId) return;
    await api.put(`/managed-agents/${agentId}/workspace-file`, {
      path: filename,
      content: newContent,
    });
    setContent(newContent);
  };

  return { content, loading, save };
}

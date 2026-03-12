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

export function useAgentDetail(agentId: string | null) {
  const [agent, setAgent] = useState<ManagedAgent | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ManagedAgent }>(`/managed-agents/${id}`);
      setAgent(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!agentId) { setAgent(null); return; }
    let cancelled = false;
    load(agentId).then(() => { if (cancelled) setAgent(null); });
    return () => { cancelled = true; };
  }, [agentId, load]);

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

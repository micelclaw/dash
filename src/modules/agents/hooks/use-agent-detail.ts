import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { ManagedAgent } from '../types';

export function useAgentDetail(agentId: string | null) {
  const [agent, setAgent] = useState<ManagedAgent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) { setAgent(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<{ data: ManagedAgent }>(`/managed-agents/${agentId}`);
        if (!cancelled) {
          setAgent(res.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [agentId]);

  return { agent, loading };
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
        const res = await api.get<{ data: { content: string } }>(`/managed-agents/${agentId}/file?name=${filename}`);
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

  return { content, loading };
}

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface WgEasyStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

export function useWgEasy() {
  const [status, setStatus] = useState<WgEasyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: WgEasyStatus }>('/wg-easy/status');
      setStatus(res.data);
      return res.data;
    } catch { /* silent */ }
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    fetchStatus().then(() => setLoading(false));
  }, [fetchStatus]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const res = await api.post<{ data: WgEasyStatus }>('/wg-easy/start');
      setStatus(res.data);
      if (res.data.running) {
        setStarting(false);
        return;
      }
      // Poll until running
      const poll = setInterval(async () => {
        const s = await fetchStatus();
        if (s?.running) {
          clearInterval(poll);
          setStarting(false);
        }
      }, 2000);
      setTimeout(() => { clearInterval(poll); setStarting(false); }, 120_000);
    } catch {
      toast.error('Failed to start WireGuard panel');
      setStarting(false);
    }
  }, [fetchStatus]);

  const stop = useCallback(async () => {
    try {
      const res = await api.post<{ data: WgEasyStatus }>('/wg-easy/stop');
      setStatus(res.data);
      toast.success('WireGuard panel stopped');
    } catch {
      toast.error('Failed to stop WireGuard panel');
    }
  }, []);

  return { status, loading, starting, start, stop, refresh: fetchStatus };
}

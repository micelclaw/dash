import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface ProxyStatus {
  running: boolean;
  domain: string | null;
  ssl_status: 'none' | 'pending' | 'active' | 'expired';
  ssl_expiry: string | null;
  ssl_provider: 'letsencrypt' | 'zerossl' | 'self_signed' | 'custom';
  hosts_total: number;
  hosts_enabled: number;
}

export interface ProcessLog {
  logs: string[];
  success: boolean;
  action: 'start' | 'stop';
}

export function useProxyStatus() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<'start' | 'stop' | null>(null);
  const [processLog, setProcessLog] = useState<ProcessLog | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: ProxyStatus }>('/hal/network/proxy/status');
      setStatus(res.data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  const start = useCallback(async () => {
    setActionInProgress('start');
    setProcessLog(null);
    try {
      const res = await api.post<{ data: { action: string; logs: string[]; success: boolean } }>('/hal/network/proxy/start');
      const { logs, success } = res.data;
      setProcessLog({ logs, success, action: 'start' });
      if (success) toast.success('Caddy started');
      else toast.error('Caddy failed to start');
      await fetchStatus();
    } catch {
      setProcessLog({ logs: ['Failed to connect to server'], success: false, action: 'start' });
      toast.error('Failed to start Caddy');
    } finally {
      setActionInProgress(null);
    }
  }, [fetchStatus]);

  const stop = useCallback(async () => {
    setActionInProgress('stop');
    setProcessLog(null);
    try {
      const res = await api.post<{ data: { action: string; logs: string[]; success: boolean } }>('/hal/network/proxy/stop');
      const { logs, success } = res.data;
      setProcessLog({ logs, success, action: 'stop' });
      if (success) toast.success('Caddy stopped');
      else toast.error('Caddy failed to stop');
      await fetchStatus();
    } catch {
      setProcessLog({ logs: ['Failed to connect to server'], success: false, action: 'stop' });
      toast.error('Failed to stop Caddy');
    } finally {
      setActionInProgress(null);
    }
  }, [fetchStatus]);

  const clearProcessLog = useCallback(() => setProcessLog(null), []);

  return {
    status, loading,
    actionInProgress, processLog, clearProcessLog,
    refresh: fetchStatus,
    start, stop,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface ProxyStatus {
  running: boolean;
  domain: string | null;
  ssl_status: 'none' | 'pending' | 'active' | 'expired';
  ssl_expiry: string | null;
  ssl_provider: 'letsencrypt' | 'zerossl' | 'self_signed' | 'custom';
}

export interface ProxyRoute {
  id: string;
  path: string;
  upstream: string;
  auth_required: boolean;
  rate_limit: string | null;
  upstream_tls: boolean;
}

export interface ProxyRouteInput {
  path: string;
  upstream: string;
  auth_required?: boolean;
  rate_limit?: string | null;
  upstream_tls?: boolean;
}

export interface DomainInfo {
  domain: string;
  dns_configured: boolean;
  ssl_auto: boolean;
  public_ip: string;
}

export interface ProcessLog {
  logs: string[];
  success: boolean;
  action: 'start' | 'stop';
}

export function useProxy() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [domain, setDomain] = useState<DomainInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<'start' | 'stop' | null>(null);
  const [processLog, setProcessLog] = useState<ProcessLog | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, routesRes] = await Promise.all([
        api.get<{ data: ProxyStatus }>('/hal/network/proxy/status'),
        api.get<{ data: ProxyRoute[] }>('/hal/network/proxy/routes'),
      ]);
      setStatus(statusRes.data);
      setRoutes(routesRes.data);
    } catch {
      // Caddy may not be running
      setStatus(null);
      setRoutes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const addRoute = useCallback(async (input: ProxyRouteInput) => {
    try {
      await api.post('/hal/network/proxy/routes', input);
      toast.success('Route added');
      await fetchAll();
    } catch {
      toast.error('Failed to add route');
    }
  }, [fetchAll]);

  const removeRoute = useCallback(async (routeId: string) => {
    try {
      await api.delete(`/hal/network/proxy/routes/${routeId}`);
      toast.success('Route removed');
      await fetchAll();
    } catch {
      toast.error('Failed to remove route');
    }
  }, [fetchAll]);

  const startProxy = useCallback(async () => {
    setActionInProgress('start');
    setProcessLog(null);
    try {
      const res = await api.post<{ data: { action: string; logs: string[]; success: boolean } }>('/hal/network/proxy/start');
      const { logs, success } = res.data;
      setProcessLog({ logs, success, action: 'start' });
      if (success) toast.success('Caddy started');
      else toast.error('Caddy failed to start');
      await fetchAll();
    } catch {
      setProcessLog({ logs: ['Failed to connect to server'], success: false, action: 'start' });
      toast.error('Failed to start Caddy');
    } finally {
      setActionInProgress(null);
    }
  }, [fetchAll]);

  const stopProxy = useCallback(async () => {
    setActionInProgress('stop');
    setProcessLog(null);
    try {
      const res = await api.post<{ data: { action: string; logs: string[]; success: boolean } }>('/hal/network/proxy/stop');
      const { logs, success } = res.data;
      setProcessLog({ logs, success, action: 'stop' });
      if (success) toast.success('Caddy stopped');
      else toast.error('Caddy failed to stop');
      await fetchAll();
    } catch {
      setProcessLog({ logs: ['Failed to connect to server'], success: false, action: 'stop' });
      toast.error('Failed to stop Caddy');
    } finally {
      setActionInProgress(null);
    }
  }, [fetchAll]);

  const clearProcessLog = useCallback(() => setProcessLog(null), []);

  const configureDomain = useCallback(async (domainName: string) => {
    try {
      const res = await api.post<{ data: DomainInfo }>('/hal/network/proxy/domain', { domain: domainName });
      setDomain(res.data);
      toast.success('Domain configured');
      await fetchAll();
    } catch {
      toast.error('Failed to configure domain');
    }
  }, [fetchAll]);

  return {
    status, routes, domain, loading,
    actionInProgress, processLog, clearProcessLog,
    refresh: fetchAll,
    startProxy, stopProxy,
    addRoute, removeRoute, configureDomain,
  };
}

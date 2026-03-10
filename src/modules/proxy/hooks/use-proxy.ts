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

export function useProxy() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [domain, setDomain] = useState<DomainInfo | null>(null);
  const [loading, setLoading] = useState(true);
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
    refresh: fetchAll,
    addRoute, removeRoute, configureDomain,
  };
}

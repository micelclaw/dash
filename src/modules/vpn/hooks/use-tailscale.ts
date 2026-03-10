import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  logged_in: boolean;
  hostname: string | null;
  tailnet: string | null;
  ip: string | null;
  version: string | null;
  peers: TailscalePeer[];
}

export interface TailscalePeer {
  hostname: string;
  ip: string;
  os: string;
  online: boolean;
  last_seen: string | null;
  is_exit_node: boolean;
}

export function useTailscale() {
  const [status, setStatus] = useState<TailscaleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: TailscaleStatus }>('/hal/network/tailscale/status');
      setStatus(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const install = useCallback(async () => {
    setActing(true);
    try {
      await api.post('/hal/network/tailscale/install');
      toast.success('Tailscale installed');
      await fetchStatus();
    } catch {
      toast.error('Failed to install Tailscale');
    }
    setActing(false);
  }, [fetchStatus]);

  const login = useCallback(async () => {
    setActing(true);
    try {
      const res = await api.post<{ data: { auth_url: string } }>('/hal/network/tailscale/login');
      const url = res.data.auth_url;
      window.open(url, '_blank');
      toast.success('Tailscale login started — check the opened tab');
      // Poll for status update
      setTimeout(fetchStatus, 5000);
    } catch {
      toast.error('Failed to start Tailscale login');
    }
    setActing(false);
  }, [fetchStatus]);

  const logout = useCallback(async () => {
    setActing(true);
    try {
      await api.post('/hal/network/tailscale/logout');
      toast.success('Logged out of Tailscale');
      await fetchStatus();
    } catch {
      toast.error('Failed to logout');
    }
    setActing(false);
  }, [fetchStatus]);

  return { status, loading, acting, install, login, logout, refresh: fetchStatus };
}

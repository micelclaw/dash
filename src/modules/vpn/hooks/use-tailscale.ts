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
import { toast } from 'sonner';

export interface TailscaleCert {
  domain: string;
  cert_path: string;
  key_path: string;
}

export interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  logged_in: boolean;
  hostname: string | null;
  tailnet: string | null;
  ip: string | null;
  version: string | null;
  peers: TailscalePeer[];
  https_cert: TailscaleCert | null;
}

export interface TailscalePeer {
  hostname: string;
  ip: string;
  os: string;
  online: boolean;
  last_seen: string | null;
  is_exit_node: boolean;
}

export type TailscaleAction = 'install' | 'login' | 'logout' | 'uninstall' | null;

export function useTailscale() {
  const [status, setStatus] = useState<TailscaleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentAction, setCurrentAction] = useState<TailscaleAction>(null);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [uninstallLogs, setUninstallLogs] = useState<string[]>([]);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

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

  // Clear authUrl once logged in
  useEffect(() => {
    if (status?.logged_in && authUrl) {
      setAuthUrl(null);
    }
  }, [status?.logged_in, authUrl]);

  const install = useCallback(async () => {
    setCurrentAction('install');
    setInstallLogs([]);
    try {
      const res = await api.post<{ data: { status: string; logs?: string[] } }>(
        '/hal/network/tailscale/install',
      );
      const logs = res.data.logs ?? [];
      setInstallLogs(logs);
      toast.success('Tailscale installed');
      await fetchStatus();
    } catch {
      toast.error('Failed to install Tailscale');
    }
    setCurrentAction(null);
  }, [fetchStatus]);

  const login = useCallback(async () => {
    setCurrentAction('login');
    setAuthUrl(null);
    try {
      const res = await api.post<{ data: { auth_url: string } }>('/hal/network/tailscale/login');
      setAuthUrl(res.data.auth_url);
    } catch {
      toast.error('Failed to start Tailscale login');
    }
    setCurrentAction(null);
  }, []);

  const logout = useCallback(async () => {
    setCurrentAction('logout');
    try {
      await api.post('/hal/network/tailscale/logout');
      toast.success('Logged out of Tailscale');
      await fetchStatus();
    } catch {
      toast.error('Failed to logout');
    }
    setCurrentAction(null);
  }, [fetchStatus]);

  const uninstall = useCallback(async () => {
    setCurrentAction('uninstall');
    setUninstallLogs([]);
    try {
      const res = await api.post<{ data: { status: string; logs?: string[] } }>(
        '/hal/network/tailscale/uninstall',
      );
      setUninstallLogs(res.data.logs ?? []);
      toast.success('Tailscale uninstalled');
      await fetchStatus();
    } catch {
      toast.error('Failed to uninstall Tailscale');
    }
    setCurrentAction(null);
  }, [fetchStatus]);

  // Backwards-compat: `acting` is true when any action is in progress
  const acting = currentAction !== null;

  return { status, loading, acting, currentAction, install, login, logout, uninstall, refresh: fetchStatus, installLogs, uninstallLogs, authUrl };
}

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

// ─── Types (snake_case — after api.ts transformKeys) ─────────────────

export type HostType = 'proxy' | 'redirect' | '404_host';
export type SslMode = 'auto' | 'custom' | 'none' | 'dns_challenge';
export type LbPolicy = 'round_robin' | 'least_conn' | 'random' | 'first' | 'ip_hash' | 'cookie' | 'header' | 'uri_hash';

export interface ProxyUpstream {
  id: string;
  host_id: string;
  address: string;
  weight: number;
  max_fails: number;
  fail_timeout: number;
  sort_order: number;
}

export interface ProxyHost {
  id: string;
  user_id: string;
  host_type: HostType;
  domain_names: string[];
  scheme: string;
  forward_host: string | null;
  forward_port: number | null;
  redirect_url: string | null;
  redirect_code: number;
  ssl_mode: SslMode;
  ssl_cert_id: string | null;
  force_ssl: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  cache_assets: boolean;
  block_exploits: boolean;
  websocket_support: boolean;
  http2_support: boolean;
  http3_support: boolean;
  compression: boolean;
  rate_limit: string | null;
  access_list_id: string | null;
  lb_policy: LbPolicy;
  health_check: Record<string, unknown> | null;
  custom_locations: unknown[];
  custom_headers: Record<string, unknown>;
  advanced_config: string | null;
  enabled: boolean;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  upstreams: ProxyUpstream[];
}

export interface ProxyHostInput {
  host_type: HostType;
  domain_names: string[];
  scheme?: string;
  forward_host?: string;
  forward_port?: number;
  redirect_url?: string;
  redirect_code?: number;
  ssl_mode?: SslMode;
  force_ssl?: boolean;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
  cache_assets?: boolean;
  block_exploits?: boolean;
  websocket_support?: boolean;
  http2_support?: boolean;
  http3_support?: boolean;
  compression?: boolean;
  rate_limit?: string | null;
  access_list_id?: string | null;
  lb_policy?: LbPolicy;
  health_check?: Record<string, unknown> | null;
  custom_locations?: unknown[];
  custom_headers?: Record<string, unknown>;
  advanced_config?: string | null;
  label?: string;
  notes?: string;
  upstreams?: { address: string; weight?: number }[];
}

export interface UpstreamTestResult {
  address: string;
  reachable: boolean;
  latency_ms: number | null;
  error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useProxyHosts(hostType?: HostType) {
  const [hosts, setHosts] = useState<ProxyHost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHosts = useCallback(async () => {
    try {
      const params = hostType ? { type: hostType } : undefined;
      const res = await api.get<{ data: ProxyHost[] }>('/hal/network/proxy/hosts', { params });
      setHosts(res.data);
    } catch {
      setHosts([]);
    }
    setLoading(false);
  }, [hostType]);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  const createHost = useCallback(async (input: ProxyHostInput): Promise<ProxyHost | null> => {
    try {
      const res = await api.post<{ data: ProxyHost }>('/hal/network/proxy/hosts', input);
      toast.success('Host created');
      await fetchHosts();
      return res.data;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create host');
      return null;
    }
  }, [fetchHosts]);

  const updateHost = useCallback(async (id: string, input: Partial<ProxyHostInput>): Promise<ProxyHost | null> => {
    try {
      const res = await api.put<{ data: ProxyHost }>(`/hal/network/proxy/hosts/${id}`, input);
      toast.success('Host updated');
      await fetchHosts();
      return res.data;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update host');
      return null;
    }
  }, [fetchHosts]);

  const deleteHost = useCallback(async (id: string) => {
    try {
      await api.delete(`/hal/network/proxy/hosts/${id}`);
      toast.success('Host deleted');
      await fetchHosts();
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete host');
      return false;
    }
  }, [fetchHosts]);

  const toggleHost = useCallback(async (id: string, enabled: boolean) => {
    try {
      await api.post(`/hal/network/proxy/hosts/${id}/toggle`, { enabled });
      toast.success(enabled ? 'Host enabled' : 'Host disabled');
      await fetchHosts();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to toggle host');
    }
  }, [fetchHosts]);

  const testHost = useCallback(async (id: string): Promise<UpstreamTestResult | null> => {
    try {
      const res = await api.post<{ data: UpstreamTestResult }>(`/hal/network/proxy/hosts/${id}/test`);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      await api.post('/hal/network/proxy/sync');
      toast.success('Config synced to Caddy');
    } catch {
      toast.error('Failed to sync config');
    }
  }, []);

  return {
    hosts, loading,
    refresh: fetchHosts,
    createHost, updateHost, deleteHost, toggleHost, testHost, sync,
  };
}

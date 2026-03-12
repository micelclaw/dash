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

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────

export type DdnsProviderType = 'cloudflare' | 'duckdns' | 'noip' | 'dynu' | 'freedns' | 'custom';

export interface DdnsProviderStatus {
  id: string;
  type: DdnsProviderType;
  hostname: string;
  enabled: boolean;
  status: 'synced' | 'error' | 'pending' | 'updating';
  last_update: string | null;
  last_ip: string | null;
  last_error: string | null;
}

export interface DdnsStatus {
  enabled: boolean;
  current_ip: string | null;
  last_check: string | null;
  last_change: string | null;
  next_check: string | null;
  interval_minutes: number;
  providers: DdnsProviderStatus[];
}

export interface DdnsConfig {
  enabled: boolean;
  interval_minutes: number;
  detection_method: 'auto' | 'interface' | 'custom_url';
  custom_detection_url: string | null;
  interface_name: string | null;
  providers: Array<{
    id: string;
    type: DdnsProviderType;
    hostname: string;
    enabled: boolean;
    [key: string]: unknown;
  }>;
}

export interface DdnsHistoryEntry {
  timestamp: string;
  old_ip: string | null;
  new_ip: string;
  providers_updated: string[];
  providers_failed: Array<{ id: string; error: string }>;
}

export interface DdnsUpdateResult {
  provider_id: string;
  success: boolean;
  message: string;
}

// ─── Hook ───────────────────────────────────────────────

export function useDdns() {
  const [status, setStatus] = useState<DdnsStatus | null>(null);
  const [config, setConfig] = useState<DdnsConfig | null>(null);
  const [history, setHistory] = useState<DdnsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: DdnsStatus }>('/ddns/status');
      setStatus(res.data);
    } catch {
      // DDNS not available
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: DdnsConfig }>('/ddns/config');
      setConfig(res.data);
    } catch {
      // DDNS not available
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<{ data: DdnsHistoryEntry[] }>('/ddns/history');
      setHistory(res.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchConfig(), fetchHistory()]);
    setLoading(false);
  }, [fetchStatus, fetchConfig, fetchHistory]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchStatus, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, fetchStatus]);

  const updateConfig = useCallback(async (partial: Partial<DdnsConfig>) => {
    try {
      const res = await api.put<{ data: DdnsConfig }>('/ddns/config', partial);
      setConfig(res.data);
      await fetchStatus();
      toast.success('DDNS config updated');
    } catch {
      toast.error('Failed to update DDNS config');
    }
  }, [fetchStatus]);

  const addProvider = useCallback(async (input: Record<string, unknown>) => {
    try {
      await api.post('/ddns/providers', input);
      await fetchAll();
      toast.success('Provider added');
      return true;
    } catch {
      toast.error('Failed to add provider');
      return false;
    }
  }, [fetchAll]);

  const updateProvider = useCallback(async (id: string, input: Record<string, unknown>) => {
    try {
      await api.put(`/ddns/providers/${id}`, input);
      await fetchAll();
      toast.success('Provider updated');
    } catch {
      toast.error('Failed to update provider');
    }
  }, [fetchAll]);

  const removeProvider = useCallback(async (id: string) => {
    try {
      await api.delete(`/ddns/providers/${id}`);
      await fetchAll();
      toast.success('Provider removed');
    } catch {
      toast.error('Failed to remove provider');
    }
  }, [fetchAll]);

  const forceUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const res = await api.post<{ data: DdnsUpdateResult[] }>('/ddns/force-update');
      const results = res.data;
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success('All providers updated');
      } else {
        toast.error(`${failed.length} provider(s) failed to update`);
      }
      await fetchAll();
    } catch {
      toast.error('Failed to force update');
    } finally {
      setUpdating(false);
    }
  }, [fetchAll]);

  return {
    status,
    config,
    history,
    loading,
    updating,
    refresh: fetchAll,
    updateConfig,
    addProvider,
    updateProvider,
    removeProvider,
    forceUpdate,
  };
}

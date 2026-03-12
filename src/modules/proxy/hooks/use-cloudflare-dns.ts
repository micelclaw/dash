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

export interface CloudflareConfigResponse {
  zone_id: string;
  zone_name: string;
  has_token: boolean;
}

export interface DnsRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS';
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  locked: boolean;
  created_on: string;
  modified_on: string;
}

export interface DnsRecordInput {
  type: DnsRecord['type'];
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export function useCloudflare() {
  const [config, setConfig] = useState<CloudflareConfigResponse | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: CloudflareConfigResponse }>('/proxy/cloudflare/config');
      setConfig(res.data);
      return res.data;
    } catch {
      setConfig(null);
      return null;
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await api.get<{ data: DnsRecord[] }>('/proxy/cloudflare/dns');
      setRecords(res.data);
    } catch {
      setRecords([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const cfg = await fetchConfig();
    if (cfg?.has_token) await fetchRecords();
    setLoading(false);
  }, [fetchConfig, fetchRecords]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveConfig = useCallback(async (apiToken: string, zoneId: string) => {
    try {
      const res = await api.put<{ data: CloudflareConfigResponse }>('/proxy/cloudflare/config', {
        api_token: apiToken,
        zone_id: zoneId,
      });
      setConfig(res.data);
      toast.success('Cloudflare connected');
      await fetchRecords();
    } catch {
      toast.error('Failed to connect Cloudflare');
    }
  }, [fetchRecords]);

  const removeConfig = useCallback(async () => {
    try {
      await api.delete('/proxy/cloudflare/config');
      setConfig(null);
      setRecords([]);
      toast.success('Cloudflare disconnected');
    } catch {
      toast.error('Failed to disconnect Cloudflare');
    }
  }, []);

  const createRecord = useCallback(async (input: DnsRecordInput) => {
    try {
      await api.post('/proxy/cloudflare/dns', input);
      toast.success('DNS record created');
      await fetchRecords();
    } catch {
      toast.error('Failed to create DNS record');
    }
  }, [fetchRecords]);

  const updateRecord = useCallback(async (recordId: string, input: Partial<DnsRecordInput>) => {
    try {
      await api.patch(`/proxy/cloudflare/dns/${recordId}`, input);
      toast.success('DNS record updated');
      await fetchRecords();
    } catch {
      toast.error('Failed to update DNS record');
    }
  }, [fetchRecords]);

  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      await api.delete(`/proxy/cloudflare/dns/${recordId}`);
      toast.success('DNS record deleted');
      await fetchRecords();
    } catch {
      toast.error('Failed to delete DNS record');
    }
  }, [fetchRecords]);

  return {
    config, records, loading,
    refresh, saveConfig, removeConfig,
    createRecord, updateRecord, deleteRecord,
  };
}

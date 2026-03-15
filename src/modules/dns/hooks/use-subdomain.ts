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

export interface MicelclawSubdomainData {
  subdomain: string;
  active: boolean;
  zone_id: string | null;
  ns_verified: boolean;
  ddns_enabled: boolean;
  created_at: string;
  instance_ip: string;
  nft_token_id: string | null;
  // Legacy fields (from old subdomain.service)
  full_domain?: string;
  status?: 'requested' | 'provisioning' | 'active' | 'failed' | 'released';
  record_types?: string[];
  requested_at?: string;
  provisioned_at?: string | null;
  server_ip?: string;
  error?: string | null;
}

export function useSubdomain() {
  const [request, setRequest] = useState<MicelclawSubdomainData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequest = useCallback(async () => {
    try {
      const res = await api.get<{ data: MicelclawSubdomainData | null }>('/dns/micelclaw-subdomain');
      setRequest(res.data);
    } catch {
      setRequest(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const requestSubdomain = useCallback(async (subdomain: string, recordTypes: string[]) => {
    try {
      const res = await api.post<{ data: MicelclawSubdomainData }>('/proxy/subdomain', {
        subdomain,
        record_types: recordTypes,
      });
      setRequest(res.data);
      toast.success('Subdomain requested');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'FEATURE_NOT_AVAILABLE') {
        toast.error('Pro account required for subdomain requests');
      } else {
        toast.error('Failed to request subdomain');
      }
    }
  }, []);

  const release = useCallback(async () => {
    try {
      await api.delete('/proxy/subdomain');
      setRequest(null);
      toast.success('Subdomain released');
    } catch {
      toast.error('Failed to release subdomain');
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.post<{ data: MicelclawSubdomainData }>('/proxy/subdomain/check');
      setRequest(res.data);
    } catch {
      toast.error('Failed to check subdomain status');
    }
  }, []);

  return {
    request, loading,
    requestSubdomain, release, checkStatus,
  };
}

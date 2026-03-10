import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface SubdomainRequest {
  subdomain: string;
  full_domain: string;
  status: 'requested' | 'provisioning' | 'active' | 'failed' | 'released';
  record_types: ('web' | 'email' | 'custom')[];
  requested_at: string;
  provisioned_at: string | null;
  server_ip: string;
  error: string | null;
}

export function useSubdomain() {
  const [request, setRequest] = useState<SubdomainRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequest = useCallback(async () => {
    try {
      const res = await api.get<{ data: SubdomainRequest | null }>('/proxy/subdomain');
      setRequest(res.data);
    } catch {
      setRequest(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const requestSubdomain = useCallback(async (subdomain: string, recordTypes: string[]) => {
    try {
      const res = await api.post<{ data: SubdomainRequest }>('/proxy/subdomain', {
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
      const res = await api.post<{ data: SubdomainRequest }>('/proxy/subdomain/check');
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

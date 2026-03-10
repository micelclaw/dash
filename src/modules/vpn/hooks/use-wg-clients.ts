import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

// Note: API returns camelCase, api client transforms to snake_case
export interface WgClient {
  id: string;
  name: string;
  enabled: boolean;
  address: string;
  public_key: string;
  created_at: string;
  updated_at: string;
  persistent_keepalive: string;
  latest_handshake_at: string | null;
  transfer_rx: number;
  transfer_tx: number;
  endpoint: string | null;
}

export function useWgClients() {
  const [clients, setClients] = useState<WgClient[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: WgClient[] }>('/wg-easy/clients');
      setClients(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const create = useCallback(async (name: string) => {
    try {
      const res = await api.post<{ data: WgClient }>('/wg-easy/clients', { name });
      setClients((prev) => [...prev, res.data]);
      toast.success(`Peer "${name}" created`);
      return res.data;
    } catch {
      toast.error('Failed to create peer');
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await api.delete(`/wg-easy/clients/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
      toast.success('Peer deleted');
    } catch {
      toast.error('Failed to delete peer');
    }
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await api.post(`/wg-easy/clients/${id}/toggle`, { enabled });
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
    } catch {
      toast.error('Failed to toggle peer');
    }
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    try {
      await api.put(`/wg-easy/clients/${id}/name`, { name });
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      toast.success('Peer renamed');
    } catch {
      toast.error('Failed to rename peer');
    }
  }, []);

  const getConfig = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await api.get<{ data: { config: string } }>(`/wg-easy/clients/${id}/config`);
      return res.data.config;
    } catch {
      toast.error('Failed to get config');
      return null;
    }
  }, []);

  const getQrCode = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await api.get<{ data: { svg: string } }>(`/wg-easy/clients/${id}/qrcode`);
      return res.data.svg;
    } catch {
      toast.error('Failed to get QR code');
      return null;
    }
  }, []);

  return { clients, loading, refresh, create, remove, toggle, rename, getConfig, getQrCode };
}

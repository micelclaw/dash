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

// ─── Types ──────────────────────────────────────────────

export type DnsProviderType = 'powerdns' | 'cloudflare' | 'porkbun' | 'namecheap' | 'hetzner';

export interface DnsProviderAccount {
  id: string;
  user_id: string;
  provider: DnsProviderType;
  label: string;
  credentials: Record<string, unknown>;
  verified: boolean;
  verified_at: string | null;
  zones_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DnsProviderAccountInput {
  provider: DnsProviderType;
  label: string;
  credentials: Record<string, unknown>;
}

// ─── Hook ───────────────────────────────────────────────

export function useDnsProviders() {
  const [providers, setProviders] = useState<DnsProviderAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await api.get<{ data: DnsProviderAccount[] }>('/dns/provider-accounts');
      setProviders(res.data);
    } catch {
      // not available
    }
  }, []);

  useEffect(() => {
    fetchProviders().then(() => setLoading(false));
  }, [fetchProviders]);

  const addProvider = useCallback(async (input: DnsProviderAccountInput) => {
    try {
      const res = await api.post<{ data: DnsProviderAccount }>('/dns/provider-accounts', input);
      setProviders(prev => [...prev, res.data]);
      if (res.data.verified) {
        toast.success('Provider connected and verified');
      } else {
        toast.warning('Provider saved but connection test failed. Check your API token.');
      }
      return res.data;
    } catch (err) {
      console.error('Add provider error:', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al conectar: ${msg}`);
      return null;
    }
  }, []);

  const testConnection = useCallback(async (id: string) => {
    try {
      const res = await api.post<{ data: { connected: boolean; error?: string } }>(`/dns/provider-accounts/${id}/test`);
      if (res.data.connected) {
        toast.success('Connection verified');
        await fetchProviders();
      } else {
        const detail = res.data.error ?? 'Verifica que el token API es válido y tiene los permisos correctos';
        toast.error(`La conexión falló: ${detail}`);
      }
      return res.data.connected;
    } catch (err) {
      console.error('Test connection error:', err);
      toast.error('Error al probar la conexión. Revisa los logs del servidor.');
      return false;
    }
  }, [fetchProviders]);

  const removeProvider = useCallback(async (id: string) => {
    try {
      await api.delete(`/dns/provider-accounts/${id}`);
      setProviders(prev => prev.filter(p => p.id !== id));
      toast.success('Provider removed');
    } catch {
      toast.error('Failed to remove provider');
    }
  }, []);

  return {
    providers,
    loading,
    refresh: fetchProviders,
    addProvider,
    testConnection,
    removeProvider,
  };
}

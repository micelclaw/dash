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

export interface LocalDomain {
  id: string;
  hostname: string;
  fqdn: string;
  ip: string;
  port: number | null;
  proxy_host_id: string | null;
  ttl: number;
}

export interface LocalDomainSetup {
  lan_ip: string | null;
  domain_count: number;
  tld: string;
}

export interface LocalDomainInput {
  hostname: string;
  ip: string;
  port?: number;
}

// ─── Hook ───────────────────────────────────────────────

export function useLocalDomains() {
  const [domains, setDomains] = useState<LocalDomain[]>([]);
  const [setup, setSetup] = useState<LocalDomainSetup | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await api.get<{ data: LocalDomain[] }>('/dns/local-domains');
      setDomains(res.data);
    } catch {
      // not available
    }
  }, []);

  const fetchSetup = useCallback(async () => {
    try {
      const res = await api.get<{ data: LocalDomainSetup }>('/dns/local-domains/setup');
      setSetup(res.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchDomains(), fetchSetup()]);
    setLoading(false);
  }, [fetchDomains, fetchSetup]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addDomain = useCallback(async (input: LocalDomainInput) => {
    try {
      const res = await api.post<{ data: LocalDomain }>('/dns/local-domains', input);
      setDomains(prev => [...prev, res.data]);
      await fetchSetup();
      toast.success(`${input.hostname}.claw creado`);
      return res.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear dominio local';
      toast.error(msg);
      return null;
    }
  }, [fetchSetup]);

  const removeDomain = useCallback(async (id: string) => {
    try {
      await api.delete(`/dns/local-domains/${id}`);
      setDomains(prev => prev.filter(d => d.id !== id));
      await fetchSetup();
      toast.success('Dominio local eliminado');
    } catch {
      toast.error('Error al eliminar dominio local');
    }
  }, [fetchSetup]);

  const downloadCaCertificate = useCallback(async () => {
    try {
      const res = await fetch('/api/dns/local-domains/ca-certificate');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'No se pudo obtener el certificado');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'micelclaw-ca.pem';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificado CA descargado');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al descargar certificado';
      toast.error(msg);
    }
  }, []);

  return {
    domains,
    setup,
    loading,
    addDomain,
    removeDomain,
    downloadCaCertificate,
    refresh: fetchAll,
  };
}

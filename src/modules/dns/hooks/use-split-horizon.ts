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

import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────

export interface SplitHorizonRecord {
  id: string;
  zone_id: string;
  record_name: string;
  internal_ip: string;
  external_ip: string;
  internal_networks: string[];
  lua_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SplitHorizonInput {
  record_name: string;
  internal_ip: string;
  external_ip: string;
  internal_networks?: string[];
}

// ─── Hook ───────────────────────────────────────────────

export function useSplitHorizon() {
  const [records, setRecords] = useState<SplitHorizonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultNetworks, setDefaultNetworks] = useState<string[]>([]);

  const fetchRecords = useCallback(async (zoneId: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: SplitHorizonRecord[] }>(`/dns/zones/${zoneId}/split-records`);
      setRecords(res.data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDefaultNetworks = useCallback(async () => {
    try {
      const res = await api.get<{ data: string[] }>('/dns/split-horizon/default-networks');
      setDefaultNetworks(res.data);
    } catch {
      setDefaultNetworks(['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']);
    }
  }, []);

  const createRecord = useCallback(async (zoneId: string, input: SplitHorizonInput) => {
    try {
      const res = await api.post<{ data: SplitHorizonRecord }>(`/dns/zones/${zoneId}/split-records`, input);
      setRecords(prev => [...prev, res.data]);
      toast.success('Split-horizon record creado');
      return res.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear split-horizon record';
      toast.error(msg);
      return null;
    }
  }, []);

  const updateRecord = useCallback(async (zoneId: string, recordId: string, input: SplitHorizonInput) => {
    try {
      const res = await api.put<{ data: SplitHorizonRecord }>(`/dns/zones/${zoneId}/split-records/${recordId}`, input);
      setRecords(prev => prev.map(r => r.id === recordId ? res.data : r));
      toast.success('Split-horizon record actualizado');
      return res.data;
    } catch {
      toast.error('Error al actualizar split-horizon record');
      return null;
    }
  }, []);

  const removeRecord = useCallback(async (zoneId: string, recordId: string) => {
    try {
      await api.delete(`/dns/zones/${zoneId}/split-records/${recordId}`);
      setRecords(prev => prev.filter(r => r.id !== recordId));
      toast.success('Split-horizon record eliminado');
    } catch {
      toast.error('Error al eliminar split-horizon record');
    }
  }, []);

  return {
    records,
    loading,
    defaultNetworks,
    fetchRecords,
    fetchDefaultNetworks,
    createRecord,
    updateRecord,
    removeRecord,
  };
}

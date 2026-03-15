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

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS';
export type DnsZoneMode = 'authoritative' | 'proxy';
export type DnsZoneType = 'micelclaw_subdomain' | 'own_domain' | 'local';

export interface DnsZone {
  id: string;
  user_id: string;
  zone: string;
  zone_type: DnsZoneType;
  mode: DnsZoneMode;
  provider_account_id: string | null;
  provider_zone_id: string | null;
  powerdns_zone_id: string | null;
  ns_verified: boolean;
  ns_verified_at: string | null;
  ddns_enabled: boolean;
  ddns_record_ids: string[];
  local_tld: string | null;
  dnssec_enabled: boolean;
  notes: string | null;
  records_count?: number;
  provider_label?: string;
  created_at: string;
  updated_at: string;
}

export interface DnsRecord {
  id: string;
  zone_id: string;
  type: DnsRecordType;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  locked: boolean;
  created_at: string | null;
  modified_at: string | null;
}

export interface DnsRecordInput {
  type: DnsRecordType;
  name: string;
  content: string;
  ttl?: number;
  priority?: number | null;
  proxied?: boolean;
}

export interface DnsTemplate {
  id: string;
  name: string;
  description: string;
  required_variables: string[];
  records: Array<{
    type: DnsRecordType;
    name_template: string;
    content_template: string;
    ttl: number;
    priority?: number;
  }>;
}

export interface NsVerificationResult {
  verified: boolean;
  ns_found: string[];
  expected_ip: string | null;
  resolved_ip: string | null;
  propagation_status: 'pending' | 'verified' | 'failed';
  retry_at: string | null;
}

export interface Port53CheckResult {
  accessible: boolean;
  udp: boolean;
  tcp: boolean;
  recommendation: string | null;
}

export interface DnssecStatus {
  enabled: boolean;
  algorithm: string | null;
  keys: Array<{
    id: number;
    type: string;
    algorithm: string;
    active: boolean;
    ds: string[];
  }>;
  ds_records: Array<{
    key_tag: number;
    algorithm: number;
    digest_type: number;
    digest: string;
  }>;
}

export interface AddZoneInput {
  zone: string;
  mode: DnsZoneMode;
  provider_account_id?: string;
}

// ─── Hook ───────────────────────────────────────────────

export function useDnsZones() {
  const [zones, setZones] = useState<DnsZone[]>([]);
  const [templates, setTemplates] = useState<DnsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchZones = useCallback(async () => {
    try {
      const res = await api.get<{ data: DnsZone[] }>('/dns/zones');
      setZones(res.data);
    } catch {
      // DNS not available
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<{ data: DnsTemplate[] }>('/dns/templates');
      setTemplates(res.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchZones(), fetchTemplates()]);
    setLoading(false);
  }, [fetchZones, fetchTemplates]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchZones, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, fetchZones]);

  // ─── Records ────────────────────────────────────────────

  const fetchRecords = useCallback(async (zoneId: string) => {
    setRecordsLoading(true);
    try {
      const res = await api.get<{ data: DnsRecord[] }>(`/dns/zones/${zoneId}/records`);
      setRecords(res.data);
    } catch {
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const selectZone = useCallback((zoneId: string | null) => {
    setSelectedZoneId(zoneId);
    if (zoneId) {
      fetchRecords(zoneId);
    } else {
      setRecords([]);
    }
  }, [fetchRecords]);

  // ─── Zone CRUD ──────────────────────────────────────────

  const addZone = useCallback(async (input: AddZoneInput) => {
    try {
      const res = await api.post<{ data: DnsZone }>('/dns/zones', input);
      setZones(prev => [...prev, res.data]);
      toast.success(`Zone ${input.zone} added`);
      return res.data;
    } catch {
      toast.error('Failed to add zone');
      return null;
    }
  }, []);

  const removeZone = useCallback(async (zoneId: string) => {
    try {
      await api.delete(`/dns/zones/${zoneId}`);
      setZones(prev => prev.filter(z => z.id !== zoneId));
      if (selectedZoneId === zoneId) {
        setSelectedZoneId(null);
        setRecords([]);
      }
      toast.success('Zone removed');
    } catch {
      toast.error('Failed to remove zone');
    }
  }, [selectedZoneId]);

  const syncZone = useCallback(async (zoneId: string) => {
    try {
      const res = await api.post<{ data: DnsZone }>(`/dns/zones/${zoneId}/sync`);
      setZones(prev => prev.map(z => z.id === zoneId ? res.data : z));
      if (selectedZoneId === zoneId) fetchRecords(zoneId);
      toast.success('Zone synced');
    } catch {
      toast.error('Failed to sync zone');
    }
  }, [selectedZoneId, fetchRecords]);

  const verifyNs = useCallback(async (zoneId: string) => {
    try {
      const res = await api.post<{ data: NsVerificationResult }>(`/dns/zones/${zoneId}/verify-ns`);
      await fetchZones();
      return res.data;
    } catch {
      toast.error('NS verification failed');
      return null;
    }
  }, [fetchZones]);

  const updateZoneDdns = useCallback(async (zoneId: string, enabled: boolean, recordIds: string[]) => {
    try {
      await api.put(`/dns/zones/${zoneId}/ddns`, { enabled, record_ids: recordIds });
      await fetchZones();
      toast.success('DDNS settings updated');
    } catch {
      toast.error('Failed to update DDNS settings');
    }
  }, [fetchZones]);

  // ─── Record CRUD ────────────────────────────────────────

  const createRecord = useCallback(async (zoneId: string, input: DnsRecordInput) => {
    try {
      const res = await api.post<{ data: DnsRecord }>(`/dns/zones/${zoneId}/records`, input);
      setRecords(prev => [...prev, res.data]);
      await fetchZones(); // refresh records_count
      toast.success('Record created');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create record';
      toast.error(`Error al crear registro: ${msg}`);
    }
  }, [fetchZones]);

  const updateRecord = useCallback(async (zoneId: string, recordId: string, input: Partial<DnsRecordInput>) => {
    try {
      const res = await api.put<{ data: DnsRecord }>(`/dns/zones/${zoneId}/records/${recordId}`, input);
      setRecords(prev => prev.map(r => r.id === recordId ? res.data : r));
      toast.success('Record updated');
    } catch {
      toast.error('Failed to update record');
    }
  }, []);

  const deleteRecord = useCallback(async (zoneId: string, recordId: string) => {
    try {
      await api.delete(`/dns/zones/${zoneId}/records/${recordId}`);
      setRecords(prev => prev.filter(r => r.id !== recordId));
      await fetchZones();
      toast.success('Record deleted');
    } catch {
      toast.error('Failed to delete record');
    }
  }, [fetchZones]);

  // ─── Templates ──────────────────────────────────────────

  const applyTemplate = useCallback(async (zoneId: string, templateId: string, variables: Record<string, string>) => {
    try {
      const res = await api.post<{ data: DnsRecord[] }>(`/dns/zones/${zoneId}/apply-template`, {
        template: templateId,
        variables,
      });
      if (selectedZoneId === zoneId) {
        setRecords(prev => [...prev, ...res.data]);
      }
      await fetchZones();
      toast.success(`Template applied — ${res.data.length} records created`);
      return true;
    } catch {
      toast.error('Failed to apply template');
      return false;
    }
  }, [selectedZoneId, fetchZones]);

  // ─── DNSSEC ───────────────────────────────────────────

  const getDnssecStatus = useCallback(async (zoneId: string) => {
    try {
      const res = await api.get<{ data: DnssecStatus }>(`/dns/zones/${zoneId}/dnssec`);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const enableDnssec = useCallback(async (zoneId: string) => {
    try {
      const res = await api.post<{ data: DnssecStatus }>(`/dns/zones/${zoneId}/dnssec/enable`);
      await fetchZones();
      toast.success('DNSSEC activado');
      return res.data;
    } catch {
      toast.error('Error al activar DNSSEC');
      return null;
    }
  }, [fetchZones]);

  const disableDnssec = useCallback(async (zoneId: string) => {
    try {
      await api.post(`/dns/zones/${zoneId}/dnssec/disable`);
      await fetchZones();
      toast.success('DNSSEC desactivado');
    } catch {
      toast.error('Error al desactivar DNSSEC');
    }
  }, [fetchZones]);

  // ─── Network diagnostics ───────────────────────────────

  const getPublicIp = useCallback(async () => {
    try {
      const res = await api.get<{ data: { ip: string } }>('/dns/network/public-ip');
      return res.data.ip;
    } catch {
      return null;
    }
  }, []);

  const checkPort53 = useCallback(async () => {
    try {
      const res = await api.get<{ data: Port53CheckResult }>('/dns/network/port53-check');
      return res.data;
    } catch {
      return null;
    }
  }, []);

  return {
    zones,
    templates,
    loading,
    selectedZoneId,
    records,
    recordsLoading,
    selectZone,
    refresh: fetchAll,
    addZone,
    removeZone,
    syncZone,
    verifyNs,
    updateZoneDdns,
    createRecord,
    updateRecord,
    deleteRecord,
    applyTemplate,
    getPublicIp,
    checkPort53,
    getDnssecStatus,
    enableDnssec,
    disableDnssec,
  };
}

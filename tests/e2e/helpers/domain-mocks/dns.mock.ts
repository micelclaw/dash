import type { MockRoute } from '../api-spy';

const ZONE_1 = {
  id: 'zone-1',
  domain: 'example.com',
  zone: 'example.com',
  zone_type: 'own_domain',
  mode: 'authoritative',
  provider_account_id: null,
  provider_zone_id: null,
  powerdns_zone_id: null,
  ns_verified: true,
  ns_verified_at: '2026-01-01T00:00:00Z',
  ddns_enabled: false,
  ddns_record_ids: [],
  local_tld: null,
  dnssec_enabled: false,
  notes: null,
  records_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const RECORD_1 = {
  id: 'rec-1',
  zone_id: 'zone-1',
  type: 'A',
  name: '@',
  content: '1.2.3.4',
  ttl: 3600,
  priority: null,
  proxied: false,
  locked: false,
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-01T00:00:00Z',
};

export const ZONES_LIST = [ZONE_1];

export const dnsMocks: MockRoute[] = [
  // ─── Zones ───────────────────────────────────────────────
  {
    method: 'GET',
    path: '/dns/zones',
    response: {
      data: ZONES_LIST,
      meta: { total: 1, limit: 50, offset: 0 },
    },
  },
  {
    method: 'GET',
    path: '/dns/zones/*',
    response: {
      data: { ...ZONE_1, records: [RECORD_1] },
    },
  },
  {
    method: 'POST',
    path: '/dns/zones',
    response: {
      data: {
        ...ZONE_1,
        id: 'zone-new',
        zone: 'new.example.com',
        domain: 'new.example.com',
        records_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  {
    method: 'DELETE',
    path: '/dns/zones/*',
    response: null,
    status: 204,
  },

  // ─── Zone records ────────────────────────────────────────
  {
    method: 'DELETE',
    path: '/dns/zones/**/records/*',
    response: null,
    status: 204,
  },

  // ─── Split-horizon records ───────────────────────────────
  {
    method: 'DELETE',
    path: '/dns/zones/**/split-records/*',
    response: null,
    status: 204,
  },

  // ─── Zone DDNS toggle ────────────────────────────────────
  {
    method: 'PUT',
    path: '/dns/zones/**/ddns',
    response: null,
    status: 204,
  },

  // ─── DNSSEC disable ──────────────────────────────────────
  {
    method: 'POST',
    path: '/dns/zones/**/dnssec/disable',
    response: null,
    status: 204,
  },

  // ─── DDNS providers ──────────────────────────────────────
  {
    method: 'GET',
    path: '/dns/ddns/providers',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'POST',
    path: '/dns/ddns/providers',
    response: {
      data: {
        id: 'ddns-prov-new',
        type: 'cloudflare',
        hostname: 'dyn.example.com',
        enabled: true,
        status: 'pending',
        last_update: null,
        last_ip: null,
        last_error: null,
      },
    },
  },
  {
    method: 'PUT',
    path: '/dns/ddns/providers/*',
    response: {
      data: {
        id: 'ddns-prov-1',
        type: 'cloudflare',
        hostname: 'dyn.example.com',
        enabled: true,
        status: 'synced',
        last_update: new Date().toISOString(),
        last_ip: '1.2.3.4',
        last_error: null,
      },
    },
  },
  {
    method: 'DELETE',
    path: '/dns/ddns/providers/*',
    response: null,
    status: 204,
  },

  // ─── DDNS status / config / actions ──────────────────────
  {
    method: 'GET',
    path: '/dns/ddns/status',
    response: { data: { enabled: false } },
  },
  {
    method: 'GET',
    path: '/dns/ddns/log',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'GET',
    path: '/dns/ddns/config',
    response: { data: { provider: null } },
  },
  {
    method: 'PUT',
    path: '/dns/ddns/config',
    response: null,
    status: 204,
  },
  {
    method: 'POST',
    path: '/dns/ddns/force-update',
    response: { data: { updated: true } },
  },
  {
    method: 'GET',
    path: '/dns/ddns/history',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },

  // ─── Local domains ──────────────────────────────────────
  {
    method: 'GET',
    path: '/dns/local-domains',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/dns/local-domains/*',
    response: null,
    status: 204,
  },

  // ─── Provider accounts ──────────────────────────────────
  {
    method: 'GET',
    path: '/dns/provider-accounts',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/dns/provider-accounts/*',
    response: null,
    status: 204,
  },
];

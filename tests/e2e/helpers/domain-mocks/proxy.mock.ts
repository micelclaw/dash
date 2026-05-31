import type { MockRoute } from '../api-spy';

const HOST_1 = {
  id: 'host-1',
  domain: 'app.example.com',
  forward_host: 'localhost',
  forward_port: 3000,
  ssl: true,
  enabled: true,
  host_type: 'proxy',
};

const CERT_1 = {
  id: 'cert-1',
  domain: '*.example.com',
  provider: 'letsencrypt',
  expires_at: '2027-01-01T00:00:00Z',
};

export const proxyMocks: MockRoute[] = [
  // Proxy status
  {
    method: 'GET',
    path: '/hal/network/proxy/status',
    response: { data: { running: true, version: '2.7' } },
  },
  // Proxy hosts
  {
    method: 'GET',
    path: '/hal/network/proxy/hosts',
    response: {
      data: [HOST_1],
      meta: { total: 1, limit: 50, offset: 0 },
    },
  },
  // Proxy routes
  {
    method: 'GET',
    path: '/hal/network/proxy/routes',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Certificates
  {
    method: 'GET',
    path: '/hal/network/proxy/certificates',
    response: {
      data: [CERT_1],
      meta: { total: 1, limit: 50, offset: 0 },
    },
  },
  // Access lists (collection)
  {
    method: 'GET',
    path: '/hal/network/proxy/access-lists',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Access list (single)
  {
    method: 'GET',
    path: '/hal/network/proxy/access-lists/*',
    response: { data: { id: 'acl-1', name: 'Admin Only', items: [] } },
  },
  // Audit log
  {
    method: 'GET',
    path: '/hal/network/proxy/audit-log',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Settings
  {
    method: 'GET',
    path: '/hal/network/proxy/settings',
    response: { data: { default_site: 'congratulations' } },
  },
  // Create host
  {
    method: 'POST',
    path: '/hal/network/proxy/hosts',
    response: {
      data: {
        id: 'host-new',
        domain: 'new.example.com',
        forward_host: 'localhost',
        forward_port: 8080,
        ssl: false,
        enabled: true,
        host_type: 'proxy',
      },
    },
  },
  // Create certificate
  {
    method: 'POST',
    path: '/hal/network/proxy/certificates',
    response: {
      data: {
        id: 'cert-new',
        domain: 'new.example.com',
        provider: 'letsencrypt',
        expires_at: '2027-06-01T00:00:00Z',
      },
    },
  },
  // Create access list
  {
    method: 'POST',
    path: '/hal/network/proxy/access-lists',
    response: { data: { id: 'acl-new', name: 'New ACL', items: [] } },
  },
  // Create route
  {
    method: 'POST',
    path: '/hal/network/proxy/routes',
    response: {
      data: {
        id: 'route-new',
        source: '/api',
        destination: 'http://localhost:3000',
      },
    },
  },
  // Toggle host
  {
    method: 'POST',
    path: '/hal/network/proxy/hosts/**/toggle',
    response: { data: { enabled: false } },
  },
  // Sync
  {
    method: 'POST',
    path: '/hal/network/proxy/sync',
    response: { data: { synced: true } },
  },
  // Start proxy
  {
    method: 'POST',
    path: '/hal/network/proxy/start',
    status: 204,
    response: null,
  },
  // Stop proxy
  {
    method: 'POST',
    path: '/hal/network/proxy/stop',
    status: 204,
    response: null,
  },
  // Update host
  {
    method: 'PUT',
    path: '/hal/network/proxy/hosts/*',
    response: { data: { ...HOST_1, domain: 'updated.example.com' } },
  },
  // Update settings
  {
    method: 'PUT',
    path: '/hal/network/proxy/settings',
    response: { data: { default_site: 'updated' } },
  },
  // Update access list
  {
    method: 'PUT',
    path: '/hal/network/proxy/access-lists/*',
    response: { data: { id: 'acl-1', name: 'Updated ACL', items: [] } },
  },
  // Delete host
  {
    method: 'DELETE',
    path: '/hal/network/proxy/hosts/*',
    status: 204,
    response: null,
  },
  // Delete route
  {
    method: 'DELETE',
    path: '/hal/network/proxy/routes/*',
    status: 204,
    response: null,
  },
  // Delete certificate
  {
    method: 'DELETE',
    path: '/hal/network/proxy/certificates/*',
    status: 204,
    response: null,
  },
  // Delete access list
  {
    method: 'DELETE',
    path: '/hal/network/proxy/access-lists/*',
    status: 204,
    response: null,
  },

  // --- Cloudflare DNS ---
  {
    method: 'GET',
    path: '/proxy/cloudflare/config',
    response: { data: { configured: false } },
  },
  {
    method: 'GET',
    path: '/proxy/cloudflare/dns',
    response: { data: [], meta: { total: 0 } },
  },
  {
    method: 'PUT',
    path: '/proxy/cloudflare/config',
    status: 204,
    response: null,
  },
  {
    method: 'POST',
    path: '/proxy/cloudflare/dns',
    response: {
      data: { id: 'dns-new', type: 'A', name: 'test', content: '1.2.3.4' },
    },
  },
  {
    method: 'PATCH',
    path: '/proxy/cloudflare/dns/*',
    response: {
      data: { id: 'dns-1', type: 'A', name: 'updated', content: '1.2.3.4' },
    },
  },
  {
    method: 'DELETE',
    path: '/proxy/cloudflare/dns/*',
    status: 204,
    response: null,
  },
  {
    method: 'DELETE',
    path: '/proxy/cloudflare/config',
    status: 204,
    response: null,
  },

  // --- Subdomain ---
  {
    method: 'GET',
    path: '/proxy/subdomain',
    response: { data: { configured: false } },
  },
  {
    method: 'POST',
    path: '/proxy/subdomain',
    response: { data: { subdomain: 'test.micelclaw.net' } },
  },
  {
    method: 'POST',
    path: '/proxy/subdomain/check',
    response: { data: { available: true } },
  },
  {
    method: 'DELETE',
    path: '/proxy/subdomain',
    status: 204,
    response: null,
  },

  // --- DDNS ---
  {
    method: 'GET',
    path: '/ddns/status',
    response: { data: { enabled: false } },
  },
  {
    method: 'GET',
    path: '/ddns/config',
    response: { data: { provider: null } },
  },
  {
    method: 'GET',
    path: '/ddns/history',
    response: { data: [], meta: { total: 0 } },
  },
  {
    method: 'PUT',
    path: '/ddns/config',
    status: 204,
    response: null,
  },
  {
    method: 'POST',
    path: '/ddns/providers',
    response: { data: { id: 'provider-new', name: 'Cloudflare', type: 'cloudflare' } },
  },
  {
    method: 'PUT',
    path: '/ddns/providers/*',
    response: { data: { id: 'provider-1', name: 'Updated', type: 'cloudflare' } },
  },
  {
    method: 'DELETE',
    path: '/ddns/providers/*',
    status: 204,
    response: null,
  },
  {
    method: 'POST',
    path: '/ddns/force-update',
    response: { data: { updated: true } },
  },
];

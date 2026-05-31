import type { MockRoute } from '../api-spy';

const DOMAIN_1 = {
  domain: 'example.com',
  active: true,
  dkim_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
};

const USER_1 = {
  email: 'admin@example.com',
  display_name: 'Admin',
  quota_used: 0,
  quota_limit: 0,
  created_at: '2026-01-01T00:00:00Z',
};

export const MAIL_DOMAINS_LIST = [DOMAIN_1];
export const MAIL_USERS_LIST = [USER_1];

export const mailServerMocks: MockRoute[] = [
  // ─── Status ──────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/status',
    response: { data: { running: true, version: '1.0' } },
  },

  // ─── Domains ─────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/domains',
    response: { data: MAIL_DOMAINS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  {
    method: 'POST',
    path: '/mail/server/domains/**/generate-dkim',
    response: { data: { dkim_record: 'v=DKIM1; k=rsa; p=...' } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/domains/*',
    response: null,
    status: 204,
  },

  // ─── Users ───────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/users',
    response: { data: MAIL_USERS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/users/*',
    response: null,
    status: 204,
  },

  // ─── Aliases ─────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/aliases',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/aliases/*',
    response: null,
    status: 204,
  },

  // ─── Alternatives ────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/alternatives',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/alternatives/*',
    response: null,
    status: 204,
  },

  // ─── Tokens ──────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/tokens',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/tokens/*',
    response: null,
    status: 204,
  },

  // ─── Relayed domains ────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/relayed-domains',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'DELETE',
    path: '/mail/server/relayed-domains/*',
    response: null,
    status: 204,
  },

  // ─── Queue ───────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/queue',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'POST',
    path: '/mail/server/queue/flush',
    response: null,
    status: 204,
  },
  {
    method: 'POST',
    path: '/mail/server/queue/**/hold',
    response: null,
    status: 204,
  },
  {
    method: 'POST',
    path: '/mail/server/queue/**/release',
    response: null,
    status: 204,
  },
  {
    method: 'DELETE',
    path: '/mail/server/queue',
    response: null,
    status: 204,
  },
  {
    method: 'DELETE',
    path: '/mail/server/queue/*',
    response: null,
    status: 204,
  },

  // ─── Security ────────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/security/lists',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  {
    method: 'POST',
    path: '/mail/server/security/learn-ham',
    response: null,
    status: 204,
  },
  {
    method: 'POST',
    path: '/mail/server/security/learn-spam',
    response: null,
    status: 204,
  },
  {
    method: 'POST',
    path: '/mail/server/security/lists',
    response: {
      data: {
        id: 'list-new',
        type: 'block',
        value: 'spam@example.com',
        created_at: new Date().toISOString(),
      },
    },
  },
  {
    method: 'DELETE',
    path: '/mail/server/security/lists/*',
    response: null,
    status: 204,
  },

  // ─── Monitoring ──────────────────────────────────────────
  {
    method: 'GET',
    path: '/mail/server/monitoring',
    response: { data: {} },
  },

  // ─── Broadcasts ──────────────────────────────────────────
  {
    method: 'POST',
    path: '/mail/server/broadcasts',
    response: { data: { sent: true } },
  },
];

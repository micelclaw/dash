/**
 * Base mocks required by every page on startup.
 * Covers auth, settings, gateway status, and other global endpoints.
 */
import type { MockRoute } from '../api-spy';

export const baseMocks: MockRoute[] = [
  // Auth
  {
    method: 'POST',
    path: '/auth/login',
    response: {
      data: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: {
          id: 'user-1',
          email: 'paco@local',
          display_name: 'Paco',
          role: 'owner',
          tier: 'pro',
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    response: {
      data: {
        access_token: 'test-access-token-refreshed',
        refresh_token: 'test-refresh-token-refreshed',
      },
    },
  },
  {
    method: 'GET',
    path: '/auth/me',
    response: {
      data: {
        id: 'user-1',
        email: 'paco@local',
        display_name: 'Paco',
        role: 'owner',
        tier: 'pro',
      },
    },
  },
  {
    method: 'GET',
    path: '/auth/pin/status',
    response: { data: { configured: false } },
  },

  // Settings
  {
    method: 'GET',
    path: '/settings',
    response: {
      data: {
        general: { language: 'es', timezone: 'Europe/Madrid', date_format: 'DD/MM/YYYY' },
        appearance: { theme: 'dark', accent: 'amber', density: 'comfortable' },
        ai: { model: 'claude-opus-4-6', temperature: 0.7, max_tokens: 4096 },
        voice: { input_mode: 'hold', auto_play: false },
        notifications: { desktop: true, sound: true, email_digest: 'daily' },
        security: { two_factor: false, session_timeout: 30 },
      },
    },
  },
  {
    method: 'PATCH',
    path: '/settings',
    response: { data: {} },
  },

  // Gateway
  {
    method: 'GET',
    path: '/gateway/status',
    response: { data: { running: true, pid: 1234, uptime: 3600 } },
  },
  {
    method: 'GET',
    path: '/gateway/health',
    response: { data: { status: 'ok' } },
  },
  {
    method: 'GET',
    path: '/gateway/snapshot',
    response: { data: { agents: [], channels: [], sessions: 0 } },
  },
  {
    method: 'GET',
    path: '/gateway/models',
    response: { data: [] },
  },
  {
    method: 'GET',
    path: '/gateway/channels',
    response: { data: [] },
  },
  {
    method: 'GET',
    path: '/gateway/sessions',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },

  // Context insights (sidebar card)
  {
    method: 'GET',
    path: '/context/insights',
    response: { data: { insights: [], computed_at: new Date().toISOString() } },
  },

  // Services
  {
    method: 'GET',
    path: '/services',
    response: { data: [] },
  },

  // Approvals badge
  {
    method: 'GET',
    path: '/approvals/count',
    response: { data: { count: 0 } },
  },

  // Health
  {
    method: 'GET',
    path: '/health',
    response: { data: { status: 'ok' } },
  },

  // Search (global search bar)
  {
    method: 'GET',
    path: '/search',
    response: { data: [], meta: { total: 0 } },
  },

  // Catch-all for unmatched GETs (prevents 404 noise during navigation)
  // Commented out — enable if tests are noisy with unhandled routes
  // {
  //   method: 'GET',
  //   path: '/**',
  //   response: { data: [] },
  // },
];

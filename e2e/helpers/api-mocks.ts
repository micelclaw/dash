/**
 * API mock data and route interceptors for Wave 5 E2E tests.
 * Uses Playwright's page.route() to intercept API calls.
 */

import type { Page } from '@playwright/test';

const API = '/api/v1';

// ─── Voice Mocks ────────────────────────────────────────────

export const MOCK_VOICE_STATUS = {
  data: {
    stt: { available: true, host: '127.0.0.1', port: 10300 },
    tts: { available: true, host: '127.0.0.1', port: 10200 },
  },
};

export const MOCK_VOICE_STATUS_OFFLINE = {
  data: {
    stt: { available: false, host: '127.0.0.1', port: 10300 },
    tts: { available: false, host: '127.0.0.1', port: 10200 },
  },
};

export const MOCK_VOICES = {
  data: [
    { name: 'es_ES-mls-medium', language: 'es_ES', description: 'Spanish MLS medium', installed: true },
    { name: 'en_US-lessac-medium', language: 'en_US', description: 'English Lessac medium', installed: true },
    { name: 'de_DE-thorsten-high', language: 'de_DE', description: 'German Thorsten high', installed: true },
  ],
};

// ─── Sensor Fusion Mocks ────────────────────────────────────

export const MOCK_SF_STATUS = {
  data: {
    ha_connected: true,
    rules_active: 3,
    last_event: new Date().toISOString(),
  },
};

export const MOCK_SF_STATUS_DISCONNECTED = {
  data: {
    ha_connected: false,
    rules_active: 0,
    last_event: null,
  },
};

export const MOCK_SF_RULES = {
  data: [
    {
      id: 'rule-1',
      name: 'Meeting Mode',
      description: 'Dim lights and mute speakers when a meeting starts',
      enabled: true,
      conditions: [{ type: 'context_temporal', field: 'current_event', operator: 'exists' }],
      actions: [{ type: 'ha_service', domain: 'light', service: 'turn_on', entity_id: 'light.office', data: { brightness: 80 } }],
      cooldown_minutes: 15,
      last_triggered: new Date(Date.now() - 3600_000).toISOString(),
      source: 'built-in',
      created_at: new Date(Date.now() - 86400_000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: 'rule-2',
      name: 'Rain Alert',
      description: 'Notify when rain is detected and windows might be open',
      enabled: false,
      conditions: [{ type: 'weather', field: 'condition', operator: 'contains', value: 'rain' }],
      actions: [{ type: 'notify', message: 'Rain detected! Check windows.' }],
      cooldown_minutes: 60,
      last_triggered: null,
      source: 'built-in',
      created_at: new Date(Date.now() - 86400_000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400_000 * 3).toISOString(),
    },
    {
      id: 'rule-3',
      name: 'Morning Briefing',
      description: 'Play a morning briefing on the kitchen speaker at 7:30',
      enabled: true,
      conditions: [{ type: 'time_window', start: '07:30', end: '07:35', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
      actions: [{ type: 'voice_tts', message: 'Good morning! Here is your briefing.', voice: 'es_ES-mls-medium' }],
      cooldown_minutes: 1440,
      last_triggered: new Date(Date.now() - 14400_000).toISOString(),
      source: 'user',
      created_at: new Date(Date.now() - 86400_000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
    },
  ],
};

export const MOCK_SF_ZONES = {
  data: [
    { name: 'Office', entities: ['binary_sensor.office_motion', 'light.office'] },
    { name: 'Kitchen', entities: ['binary_sensor.kitchen_motion', 'light.kitchen'] },
    { name: 'Bedroom', entities: ['binary_sensor.bedroom_motion', 'light.bedroom'] },
  ],
};

// ─── Permissions Mocks ──────────────────────────────────────

export const MOCK_MANAGED_AGENTS = {
  data: [
    {
      id: 'agent-1',
      name: 'francis',
      display_name: 'Francis',
      role: 'Main Router',
      avatar: null,
      model: 'claude-opus-4-6',
      color: 'var(--blue)',
      is_chief: true,
      parent_agent_id: null,
      skills: [],
      workspace_path: '/gateway/workspace/agents/francis/',
      status: 'active',
      last_active_at: new Date().toISOString(),
      sessions_today: 12,
      tokens_today: 45000,
      created_at: new Date(Date.now() - 86400_000 * 90).toISOString(),
      semantic_scopes: [],
    },
    {
      id: 'agent-2',
      name: 'elon',
      display_name: 'Elon',
      role: 'Code Specialist',
      avatar: null,
      model: 'claude-sonnet-4-5',
      color: 'var(--green)',
      is_chief: false,
      parent_agent_id: 'agent-1',
      skills: [],
      workspace_path: '/gateway/workspace/agents/elon/',
      status: 'idle',
      last_active_at: new Date(Date.now() - 3600_000).toISOString(),
      sessions_today: 3,
      tokens_today: 12000,
      created_at: new Date(Date.now() - 86400_000 * 60).toISOString(),
      semantic_scopes: [
        { domain: 'notes', filter_type: 'include', filter: { type: 'tags', tags: ['code', 'dev'] } },
      ],
    },
  ],
  meta: { total: 2, limit: 50, offset: 0 },
};

export const MOCK_APPS = {
  data: [
    {
      id: 'app-1',
      app_name: 'claw-finance',
      version: '1.2.0',
      app_level: 2,
      status: 'active',
      source: 'clawhub',
      install_path: '/apps/claw-finance',
      manifest: { name: 'claw-finance', version: '1.2.0', app_level: 2, min_core_version: '0.7.0', skill: 'claw-finance', tier_required: 'pro', permissions: ['notes:read', 'events:read'] },
      installed_by: 'user-1',
      installed_at: new Date(Date.now() - 86400_000 * 30).toISOString(),
      updated_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
      semantic_scopes: [],
    },
  ],
  meta: { total: 1, by_level: { L1: 0, L2: 1, L3: 0 } },
};

export const MOCK_SCOPE_PREVIEW = {
  data: { notes: 45, emails: 230, contacts: 12, events: 67, files: 89, diary: 15 },
};

// ─── Context Insights Mocks ─────────────────────────────────

export const MOCK_INSIGHTS = {
  data: {
    userId: 'user-1',
    insights: [
      {
        id: 'meeting-prep-evt-1',
        category: 'reminder',
        priority: 'high',
        title: '"Design Review" starts in 10 min',
        body: 'You have an upcoming event. Consider wrapping up your current work.',
        signals: ['temporal'],
        action: { type: 'navigate', payload: { route: '/calendar', eventId: 'evt-1' } },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
      {
        id: 'unread-pileup',
        category: 'suggestion',
        priority: 'medium',
        title: '14 unread emails',
        body: 'Your inbox has accumulated unread messages. Consider reviewing them.',
        signals: ['communication'],
        action: { type: 'navigate', payload: { route: '/mail' } },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
      {
        id: 'long-session',
        category: 'optimization',
        priority: 'low',
        title: 'Consider a break',
        body: "You've been active for 95 minutes. A short break can improve focus.",
        signals: ['activity'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    ],
    computedAt: new Date().toISOString(),
    llmUsed: false,
  },
};

// ─── Settings Mocks ─────────────────────────────────────────

export const MOCK_SETTINGS = {
  data: {
    general: { language: 'es', timezone: 'Europe/Madrid', date_format: 'DD/MM/YYYY' },
    appearance: { theme: 'dark', accent: 'amber', density: 'comfortable' },
    ai: { model: 'claude-opus-4-6', temperature: 0.7, max_tokens: 4096 },
    voice: { input_mode: 'hold', auto_play: false, stt_model: 'base-int8', stt_language: 'auto', tts_speed: 1.0 },
    notifications: { desktop: true, sound: true, email_digest: 'daily' },
    security: { two_factor: false, session_timeout: 30 },
  },
};

// ─── Route registration ─────────────────────────────────────

/**
 * Register all Wave 5 API mock routes on a Playwright page.
 * Call this before navigating to the app.
 */
export async function setupWave5Mocks(page: Page, overrides?: Partial<{
  voiceStatus: typeof MOCK_VOICE_STATUS;
  sfStatus: typeof MOCK_SF_STATUS;
}>) {
  // Voice
  await page.route(`**${API}/voice/status`, route =>
    route.fulfill({ json: overrides?.voiceStatus ?? MOCK_VOICE_STATUS }));
  await page.route(`**${API}/voice/voices`, route =>
    route.fulfill({ json: MOCK_VOICES }));
  await page.route(`**${API}/voice/stt`, route =>
    route.fulfill({ json: { data: { text: 'Hola, esto es una prueba de voz.' } } }));
  await page.route(`**${API}/voice/tts`, route =>
    route.fulfill({ contentType: 'audio/ogg', body: Buffer.alloc(100) }));

  // Sensor Fusion
  await page.route(`**${API}/sensor-fusion/status`, route =>
    route.fulfill({ json: overrides?.sfStatus ?? MOCK_SF_STATUS }));
  await page.route(`**${API}/sensor-fusion/rules`, route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_SF_RULES });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { data: { id: `rule-new-${Date.now()}`, ...JSON.parse(route.request().postData() || '{}'), created_at: new Date().toISOString() } } });
    }
    return route.continue();
  });
  await page.route(`**${API}/sensor-fusion/rules/*/`, route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { data: JSON.parse(route.request().postData() || '{}') } });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
  await page.route(`**${API}/sensor-fusion/zones`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: MOCK_SF_ZONES });
    if (route.request().method() === 'PUT') return route.fulfill({ json: MOCK_SF_ZONES });
    return route.continue();
  });
  await page.route(`**${API}/sensor-fusion/rules/import-built-in`, route =>
    route.fulfill({ json: { data: { imported: 6 } } }));

  // Permissions — managed agents
  await page.route(`**${API}/managed-agents`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: MOCK_MANAGED_AGENTS });
    return route.continue();
  });
  await page.route(`**${API}/managed-agents/*/`, route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { data: JSON.parse(route.request().postData() || '{}') } });
    }
    return route.continue();
  });

  // Permissions — apps
  await page.route(`**${API}/apps`, route =>
    route.fulfill({ json: MOCK_APPS }));
  await page.route(`**${API}/apps/*/`, route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { data: JSON.parse(route.request().postData() || '{}') } });
    }
    return route.continue();
  });

  // Scope preview
  await page.route(`**${API}/admin/scope-preview`, route =>
    route.fulfill({ json: MOCK_SCOPE_PREVIEW }));

  // Context insights
  await page.route(`**${API}/context/insights*`, route =>
    route.fulfill({ json: MOCK_INSIGHTS }));

  // Settings
  await page.route(`**${API}/settings`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: MOCK_SETTINGS });
    if (route.request().method() === 'PATCH') return route.fulfill({ json: MOCK_SETTINGS });
    return route.continue();
  });
}

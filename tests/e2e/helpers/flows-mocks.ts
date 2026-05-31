/**
 * API mock data and route interceptors for MicelFlow E2E tests.
 * Uses Playwright's page.route() to intercept API calls.
 */

import type { Page } from '@playwright/test';

const API = '/api/v1';

// ─── Mock data ─────────────────────────────────────────────

let mockFlows: any[] = [];
let flowIdCounter = 1;

function resetFlows() {
  mockFlows = [
    {
      id: 'flow-existing-1',
      name: 'Morning Briefing',
      description: 'Daily morning summary',
      icon: 'Sun',
      color: '#f59e0b',
      category: 'productivity',
      is_template: false,
      template_source: 'built-in:morning-briefing',
      trigger_type: 'cron',
      trigger_config: { expression: '0 8 * * *' },
      steps: [
        { id: 's1', type: 'calendar.upcoming', label: 'Today\'s events', config: { hours: 12 } },
        { id: 's2', type: 'ai.draft', label: 'Generate briefing', config: { prompt: 'Morning summary' } },
        { id: 's3', type: 'notify.dash', label: 'Show briefing', config: { title: 'Morning Briefing', body: 'Ready' } },
      ],
      enabled: true,
      last_run_at: new Date(Date.now() - 3600_000).toISOString(),
      last_status: 'completed',
      run_count: 28,
      success_count: 26,
      error_count: 2,
      version: 3,
      timeout_ms: 300000,
      retry_policy: 'none',
      event_batch_mode: 'batch',
      approval_timeout_minutes: 60,
      notification_config: { approval: ['dash'], success: ['dash'], error: ['dash'] },
      version_history: [],
      created_at: new Date(Date.now() - 86400_000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 86400_000).toISOString(),
    },
  ];
  flowIdCounter = 1;
}

export const MOCK_BUILT_IN_TEMPLATES = {
  data: [
    {
      id: 'inbox-triage',
      name: 'Inbox Triage',
      description: 'Classify emails by urgency with AI',
      icon: 'Mail',
      color: '#22c55e',
      category: 'productivity',
      trigger_type: 'cron',
      trigger_config: { expression: '0 9 * * 1-5' },
      steps: [
        { id: 's1', type: 'email.list', label: 'Get emails', config: { account: 'all', status: 'unread', limit: 50 } },
        { id: 's2', type: 'ai.classify', label: 'Classify', config: { categories: ['Urgent', 'Normal', 'Spam'] } },
        { id: 's3', type: 'control.approval', label: 'Checkpoint', config: { prompt: 'Apply classification?' } },
      ],
      wizard: {
        steps: [
          { id: 'email', title: 'Email setup', fields: [
            { id: 'account', question: 'Which email account?', type: 'select', options: [{ value: 'all', label: 'All accounts' }], default: 'all', mapsTo: 'steps[0].config.account' },
          ]},
          { id: 'schedule', title: 'Schedule', fields: [
            { id: 'when', question: 'When should it run?', type: 'select', options: [
              { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
              { value: '0 9 * * *', label: 'Every day at 9:00 AM' },
              { value: 'manual', label: 'Only when I ask' },
            ], default: '0 9 * * 1-5', mapsTo: 'trigger_config.expression' },
          ]},
        ],
      },
    },
    {
      id: 'weekly-review',
      name: 'Weekly Review',
      description: 'Summarize your week into a diary entry',
      icon: 'BookOpen',
      color: '#14b8a6',
      category: 'productivity',
      trigger_type: 'cron',
      trigger_config: { expression: '0 10 * * 0' },
      steps: [
        { id: 's1', type: 'search.semantic', label: 'Get week activity', config: { query: 'this week', limit: 20 } },
        { id: 's2', type: 'ai.summarize', label: 'Summarize', config: { max_length: 'long' } },
      ],
      wizard: { steps: [] },
    },
    {
      id: 'focus-mode',
      name: 'Focus Mode',
      description: 'Activate focus lighting when in office with meeting',
      icon: 'Zap',
      color: '#06b6d4',
      category: 'home',
      trigger_type: 'sensor',
      trigger_config: { entity_id: 'binary_sensor.office_presence', state: 'on' },
      steps: [
        { id: 's1', type: 'home.scene', label: 'Focus scene', config: { scene: 'focus' } },
      ],
      wizard: { steps: [
        { id: 'entities', title: 'Home Assistant', fields: [
          { id: 'presence', question: 'Presence sensor', type: 'text', default: 'binary_sensor.office_presence', mapsTo: 'trigger_config.entity_id' },
        ]},
      ]},
    },
  ],
};

export const MOCK_STEP_TYPES = {
  data: [
    { id: 'email.list', label: 'Get emails', category: 'email', icon: 'Mail', description: 'Get filtered emails', output_type: 'Email[]', side_effect: 'read', params: [
      { id: 'account', label: 'Account', type: 'select', options: [{ value: 'all', label: 'All' }], default: 'all' },
      { id: 'limit', label: 'Max', type: 'number', default: 50 },
    ]},
    { id: 'notes.search', label: 'Search notes', category: 'notes', icon: 'StickyNote', description: 'Search notes', output_type: 'Note[]', side_effect: 'read', params: [
      { id: 'query', label: 'Query', type: 'text' },
    ]},
    { id: 'ai.classify', label: 'Classify', category: 'ai', icon: 'Brain', description: 'Classify items', output_type: 'ClassifiedItem[]', input_type: 'any', side_effect: 'ai', params: [
      { id: 'categories', label: 'Categories', type: 'tag_input', default: ['A', 'B'] },
    ]},
    { id: 'ai.draft', label: 'Generate draft', category: 'ai', icon: 'PenLine', description: 'Draft text', output_type: 'string', input_type: 'any', side_effect: 'ai', params: [
      { id: 'prompt', label: 'Instructions', type: 'text', required: true },
    ]},
    { id: 'notify.dash', label: 'Dashboard notification', category: 'notification', icon: 'Bell', description: 'Send notification', output_type: '{ sent: true }', side_effect: 'notification', params: [
      { id: 'title', label: 'Title', type: 'text', required: true },
      { id: 'body', label: 'Message', type: 'text', required: true },
    ]},
    { id: 'control.approval', label: 'Checkpoint', category: 'control', icon: 'ShieldCheck', description: 'Ask for approval', output_type: '{ approved: boolean }', side_effect: 'control', params: [
      { id: 'prompt', label: 'Question', type: 'text', required: true },
    ]},
    { id: 'calendar.upcoming', label: 'Upcoming events', category: 'calendar', icon: 'Calendar', description: 'Get events', output_type: 'Event[]', side_effect: 'read', params: [
      { id: 'hours', label: 'Hours', type: 'number', default: 24 },
    ]},
    { id: 'home.scene', label: 'Activate scene', category: 'home', icon: 'Palette', description: 'HA scene', output_type: '{ activated: true }', side_effect: 'write', params: [
      { id: 'scene', label: 'Scene', type: 'text', required: true },
    ]},
    { id: 'search.semantic', label: 'Semantic search', category: 'search', icon: 'Search', description: 'Search', output_type: 'SearchResult[]', side_effect: 'read', params: [
      { id: 'query', label: 'Query', type: 'text', required: true },
    ]},
    { id: 'ai.summarize', label: 'Summarize', category: 'ai', icon: 'Sparkles', description: 'Summarize content', output_type: 'string', input_type: 'any', side_effect: 'ai', params: [
      { id: 'max_length', label: 'Length', type: 'select', options: [{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }], default: 'medium' },
    ]},
  ],
};

export const MOCK_FLOW_STATS = {
  data: { total_runs: 28, success_runs: 26, error_runs: 2, avg_duration_ms: 2100, total_tokens: 12400, total_cost: 0.09 },
};

export const MOCK_GLOBAL_STATS = {
  data: { total_runs: 85, successful_runs: 78, items_processed: { emails: 1280, notes: 4 }, tokens_used: 45000, cost_usd_estimate: 0.32, estimated_hours_saved: 8.5 },
};

export const MOCK_FLOW_RUNS = {
  data: [
    { id: 'run-1', flow_id: 'flow-existing-1', status: 'completed', trigger_source: 'cron', steps_completed: 3, steps_total: 3, step_results: [], tokens_used: 450, cost_usd_estimate: '0.003', duration_ms: 2100, started_at: new Date(Date.now() - 3600_000).toISOString(), completed_at: new Date(Date.now() - 3597_900).toISOString(), error: null },
    { id: 'run-2', flow_id: 'flow-existing-1', status: 'failed', trigger_source: 'cron', steps_completed: 1, steps_total: 3, step_results: [], tokens_used: 0, cost_usd_estimate: '0', duration_ms: 1500, started_at: new Date(Date.now() - 86400_000).toISOString(), completed_at: new Date(Date.now() - 86400_000 + 1500).toISOString(), error: 'Ollama not available' },
  ],
};

// ─── Route registration ────────────────────────────────────

export async function setupFlowsMocks(page: Page) {
  resetFlows();

  // GET /flows
  await page.route(`**${API}/flows`, route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { data: mockFlows.filter(f => !f.deleted_at) } });
    }
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const newFlow = {
        id: `flow-new-${flowIdCounter++}`,
        ...body,
        is_template: false,
        enabled: true,
        last_run_at: null,
        last_status: null,
        run_count: 0,
        success_count: 0,
        error_count: 0,
        version: 1,
        version_history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockFlows.push(newFlow);
      return route.fulfill({ json: { data: newFlow } });
    }
    return route.continue();
  });

  // GET/PATCH/DELETE /flows/:id
  await page.route(`**${API}/flows/flow-*`, route => {
    const url = route.request().url();
    const idMatch = url.match(/flows\/(flow-[^/]+)/);
    const id = idMatch?.[1];

    if (route.request().method() === 'GET' && !url.includes('/runs') && !url.includes('/stats') && !url.includes('/export') && !url.includes('/toggle') && !url.includes('/undo')) {
      const flow = mockFlows.find(f => f.id === id && !f.deleted_at);
      if (!flow) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Flow not found' } } });
      return route.fulfill({ json: { data: flow } });
    }

    if (route.request().method() === 'PATCH' && url.includes('/toggle')) {
      const flow = mockFlows.find(f => f.id === id);
      if (flow) flow.enabled = !flow.enabled;
      return route.fulfill({ json: { data: flow } });
    }

    if (route.request().method() === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      const flow = mockFlows.find(f => f.id === id);
      if (flow) Object.assign(flow, body, { version: flow.version + 1, updated_at: new Date().toISOString() });
      return route.fulfill({ json: { data: flow } });
    }

    if (route.request().method() === 'DELETE') {
      const flow = mockFlows.find(f => f.id === id);
      if (flow) flow.deleted_at = new Date().toISOString();
      return route.fulfill({ json: { data: { deleted: true } } });
    }

    // Runs
    if (url.includes('/runs')) {
      if (url.includes('/approve')) return route.fulfill({ json: { data: { status: 'completed' } } });
      if (url.includes('/reject')) return route.fulfill({ json: { data: { status: 'cancelled' } } });
      return route.fulfill({ json: MOCK_FLOW_RUNS });
    }

    // Stats
    if (url.includes('/stats')) return route.fulfill({ json: MOCK_FLOW_STATS });

    // Export
    if (url.includes('/export')) {
      const flow = mockFlows.find(f => f.id === id);
      return route.fulfill({ json: { data: flow ?? {} } });
    }

    // Run
    if (route.request().method() === 'POST' && url.includes('/run')) {
      return route.fulfill({ json: { data: { run_id: `run-new-${Date.now()}`, status: 'running' } } });
    }

    // Test
    if (route.request().method() === 'POST' && url.includes('/test')) {
      return route.fulfill({ json: { data: { steps: [{ step_id: 's1', status: 'ok', output_summary: 'Test passed', duration_ms: 50 }], total_duration_ms: 50, total_tokens: 0, cost_estimate: 0 } } });
    }

    // Undo
    if (route.request().method() === 'POST' && url.includes('/undo')) {
      const flow = mockFlows.find(f => f.id === id);
      return route.fulfill({ json: { data: flow } });
    }

    // Save template
    if (route.request().method() === 'POST' && url.includes('/save-template')) {
      return route.fulfill({ json: { data: { id: `tpl-${Date.now()}`, is_template: true } } });
    }

    return route.continue();
  });

  // Templates
  await page.route(`**${API}/flows/templates/built-in`, route =>
    route.fulfill({ json: MOCK_BUILT_IN_TEMPLATES }));
  await page.route(`**${API}/flows/templates`, route =>
    route.fulfill({ json: { data: [] } }));

  // Step types
  await page.route(`**${API}/flows/step-types`, route =>
    route.fulfill({ json: MOCK_STEP_TYPES }));

  // Pending
  await page.route(`**${API}/flows/pending`, route =>
    route.fulfill({ json: { data: [] } }));

  // Global stats
  await page.route(`**${API}/flows/stats/global`, route =>
    route.fulfill({ json: MOCK_GLOBAL_STATS }));

  // Import
  await page.route(`**${API}/flows/import`, route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const imported = { id: `flow-imported-${Date.now()}`, ...body, created_at: new Date().toISOString() };
    mockFlows.push(imported);
    return route.fulfill({ json: { data: imported } });
  });

  // Validate
  await page.route(`**${API}/flows/*/validate`, route =>
    route.fulfill({ json: { data: { valid: true, issues: [] } } }));
}

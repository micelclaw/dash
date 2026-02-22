import type { User } from '@/types/auth';
import type { Agent, Conversation, Message } from '@/types/chat';
import type { Note } from '@/types/notes';
import type { EntityLink } from '@/types/links';
import type { SearchResult } from '@/types/search';
import { getPreview } from '@/lib/text';

// ── Users ──

const MOCK_USER: User = {
  id: 'user-1',
  email: 'paco@local',
  display_name: 'Paco',
  role: 'owner',
  tier: 'pro',
};

// ── Agents ──

const MOCK_AGENTS: Agent[] = [
  { name: 'francis', display_name: 'Francis', role: 'Main Router', model: 'claude-opus-4-6', skills_count: 12 },
  { name: 'elon', display_name: 'Elon', role: 'Code Specialist', model: 'claude-sonnet-4-5', skills_count: 5 },
  { name: 'ana', display_name: 'Ana', role: 'Data Analyst', model: 'gemini-3-pro', skills_count: 3 },
];

// ── Conversations & Messages ──

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'conv-1', agent: 'francis', first_message: 'Budget Q3 review', message_count: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'conv-2', agent: 'francis', first_message: 'What meetings do I have today?', message_count: 3, created_at: new Date(Date.now() - 3600_000).toISOString(), updated_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: 'conv-3', agent: 'elon', first_message: 'Help me with TypeScript generics', message_count: 8, created_at: new Date(Date.now() - 86400_000).toISOString(), updated_at: new Date(Date.now() - 86400_000).toISOString() },
  { id: 'conv-4', agent: 'francis', first_message: 'Setup DNS records for new domain', message_count: 4, created_at: new Date(Date.now() - 86400_000 * 2).toISOString(), updated_at: new Date(Date.now() - 86400_000 * 2).toISOString() },
  { id: 'conv-5', agent: 'ana', first_message: 'Analyze last month expenses', message_count: 6, created_at: new Date(Date.now() - 86400_000 * 5).toISOString(), updated_at: new Date(Date.now() - 86400_000 * 5).toISOString() },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  'conv-1': [
    { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'Can you review the Budget Q3 document?', timestamp: new Date(Date.now() - 300_000).toISOString() },
    { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: "I've reviewed the **Budget Q3** document. Here are the key points:\n\n### Revenue\n- Total revenue: **€142,500** (+12% vs Q2)\n- Recurring: €98,000\n- One-time: €44,500\n\n### Expenses\n- Infrastructure: €23,400\n- Team: €67,800\n- Marketing: €15,200\n\n> Net margin is healthy at **25.3%**\n\n[Open Budget →](/notes?id=budget-q3)", agent: 'francis', model: 'claude-opus-4-6', tokens_used: 156, timestamp: new Date(Date.now() - 290_000).toISOString() },
    { id: 'm3', conversation_id: 'conv-1', role: 'user', content: 'What about the infrastructure costs breakdown?', timestamp: new Date(Date.now() - 200_000).toISOString() },
    { id: 'm4', conversation_id: 'conv-1', role: 'assistant', content: "Here's the infrastructure breakdown:\n\n| Service | Monthly | Q3 Total |\n|---------|---------|----------|\n| AWS | €3,200 | €9,600 |\n| Hetzner | €1,800 | €5,400 |\n| Cloudflare | €400 | €1,200 |\n| Monitoring | €900 | €2,700 |\n| Other | €1,500 | €4,500 |\n\nAWS costs increased 8% due to the new ML pipeline.", agent: 'francis', model: 'claude-opus-4-6', tokens_used: 189, timestamp: new Date(Date.now() - 190_000).toISOString() },
  ],
  'conv-2': [
    { id: 'm5', conversation_id: 'conv-2', role: 'user', content: 'What meetings do I have today?', timestamp: new Date(Date.now() - 7200_000).toISOString() },
    { id: 'm6', conversation_id: 'conv-2', role: 'assistant', content: "Today you have 3 meetings:\n\n- **10:00** — Standup diario [Open →](/calendar)\n- **14:00** — Design review with the team\n- **16:30** — Client call with Acme Corp\n\nYou also have a deadline for the proposal draft at 18:00.", agent: 'francis', model: 'claude-opus-4-6', tokens_used: 87, timestamp: new Date(Date.now() - 7190_000).toISOString() },
  ],
  'conv-3': [
    { id: 'm7', conversation_id: 'conv-3', role: 'user', content: 'Help me understand TypeScript generics with a practical example', timestamp: new Date(Date.now() - 90000_000).toISOString() },
    { id: 'm8', conversation_id: 'conv-3', role: 'assistant', content: "Here's a practical example of TypeScript generics:\n\n```typescript\ninterface ApiResponse<T> {\n  data: T;\n  meta: { total: number; page: number; };\n}\n\nasync function fetchApi<T>(path: string): Promise<ApiResponse<T>> {\n  const res = await fetch(path);\n  return res.json();\n}\n\nconst users = await fetchApi<User[]>('/users');\nconst note = await fetchApi<Note>('/notes/1');\n```\n\nGenerics let you write **one function** that works with **many types** while keeping full type safety.", agent: 'elon', model: 'claude-sonnet-4-5', tokens_used: 234, timestamp: new Date(Date.now() - 89990_000).toISOString() },
  ],
};

// ── Notes ──

let mockNotes: Note[] = [
  {
    id: 'note-1',
    title: 'Reunión Q3 Planning',
    content: '<h2>Asistentes</h2><p>Juan, María, Carlos</p><h2>Agenda</h2><ul><li>Revisión de métricas</li><li>Roadmap Q4</li><li>Budget allocation</li></ul><p>Conclusión: necesitamos más datos antes de decidir.</p>',
    content_format: 'html',
    source: 'local',
    source_id: null,
    tags: ['work', 'meetings'],
    pinned: true,
    archived: false,
    custom_fields: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    synced_at: null,
    deleted_at: null,
  },
  {
    id: 'note-2',
    title: 'Lista de la compra',
    content: '<ul><li>Leche</li><li>Huevos</li><li>Pan integral</li><li>Aguacates</li><li>Café</li></ul>',
    content_format: 'html',
    source: 'apple_notes',
    source_id: 'apple-123',
    tags: ['personal'],
    pinned: false,
    archived: false,
    custom_fields: null,
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    synced_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    deleted_at: null,
  },
  {
    id: 'note-3',
    title: 'Ideas proyecto X',
    content: '<p>Concepto: una app que conecta freelancers con startups.</p><p><strong>MVP features:</strong></p><ol><li>Profile creation</li><li>Project matching</li><li>In-app messaging</li></ol><p>Investigar: <a href="https://example.com">competidores similares</a></p>',
    content_format: 'html',
    source: 'google_keep',
    source_id: 'gk-456',
    tags: ['work', 'ideas'],
    pinned: false,
    archived: false,
    custom_fields: { priority: 'high' },
    created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    synced_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    deleted_at: null,
  },
  {
    id: 'note-4',
    title: 'Budget analysis Q3',
    content: '<h2>Summary</h2><p>Total spend: €45,230. Over budget by 12%.</p><pre><code class="language-json">{\n  "marketing": 15200,\n  "engineering": 22030,\n  "operations": 8000\n}</code></pre><p>Action items: reduce marketing spend, negotiate cloud costs.</p>',
    content_format: 'html',
    source: 'local',
    source_id: null,
    tags: ['work', 'finance'],
    pinned: false,
    archived: false,
    custom_fields: null,
    created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    synced_at: null,
    deleted_at: null,
  },
  {
    id: 'note-5',
    title: 'Reflexiones sobre productividad',
    content: '<p>He estado pensando en cómo mejorar mi flujo de trabajo. Creo que la clave está en <strong>reducir context switching</strong>.</p><blockquote><p>"The cost of interrupted work is not just the time lost, but the mental energy to reload context."</p></blockquote><p>Ideas:</p><ul data-type="taskList"><li data-checked="true"><p>Implementar time-blocking</p></li><li data-checked="true"><p>Limitar reuniones a martes y jueves</p></li><li data-checked="false"><p>Probar la técnica Pomodoro</p></li></ul>',
    content_format: 'html',
    source: 'synology_note',
    source_id: 'syn-789',
    tags: ['personal', 'productivity'],
    pinned: false,
    archived: false,
    custom_fields: null,
    created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    synced_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    deleted_at: null,
  },
];

// ── Entity Links ──

const MOCK_LINKS: EntityLink[] = [
  { id: 'link-1', source_type: 'note', source_id: 'note-1', target_type: 'email', target_id: 'email-1', relationship: 'mentioned_in', link_type: 'relates_to', confidence: 0.92, strength: 0.78, created_by: 'llm', created_at: new Date().toISOString() },
  { id: 'link-2', source_type: 'note', source_id: 'note-1', target_type: 'event', target_id: 'event-1', relationship: 'attendee_of', link_type: 'attended', confidence: 1.0, strength: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'link-3', source_type: 'contact', source_id: 'contact-1', target_type: 'note', target_id: 'note-1', relationship: 'mentioned_in', link_type: 'mentions', confidence: 0.88, strength: 0.65, created_by: 'llm', created_at: new Date().toISOString() },
  { id: 'link-4', source_type: 'note', source_id: 'note-4', target_type: 'email', target_id: 'email-2', relationship: 'relates_to', link_type: 'budget_discussion', confidence: 0.95, strength: 0.9, created_by: 'llm', created_at: new Date().toISOString() },
];

const MOCK_LINKED_RECORDS: Record<string, Record<string, unknown>> = {
  'email-1': { id: 'email-1', subject: 'Re: Q3 Planning Meeting', from_name: 'María García' },
  'email-2': { id: 'email-2', subject: 'Budget Q3 - Updated figures', from_name: 'Juan López' },
  'event-1': { id: 'event-1', title: 'Q3 Planning Meeting', start_at: '2026-02-18T10:00:00Z' },
  'contact-1': { id: 'contact-1', display_name: 'María García' },
};

// ── Search ──

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function getMockSearchResults(query: string, domains?: string): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];

  // Notes
  if (!domains || domains === 'notes' || domains === 'note') {
    for (const n of mockNotes) {
      if (matchesQuery(n.title || '', query) || matchesQuery(n.content, query)) {
        results.push({
          domain: 'note',
          record_id: n.id,
          score: 0.85,
          snippet: getPreview(n.content, n.content_format),
          record: n as unknown as Record<string, unknown>,
        });
      }
    }
  }

  // Other domains
  const otherResults: SearchResult[] = [
    { domain: 'event', record_id: 'event-1', score: 0.78, snippet: 'Jun 15 — Flight and hotel', record: { title: 'Viaje Valencia', start_at: '2026-06-15T08:00:00Z' } },
    { domain: 'event', record_id: 'event-2', score: 0.72, snippet: 'Daily at 10:00', record: { title: 'Team standup', start_at: '2026-02-22T10:00:00Z' } },
    { domain: 'email', record_id: 'email-1', score: 0.82, snippet: 'María García — Las cifras están listas', record: { subject: 'Re: Presupuesto Q3', from_name: 'María García' } },
    { domain: 'email', record_id: 'email-3', score: 0.75, snippet: 'Juan López — Attached the latest version', record: { subject: 'New contract draft', from_name: 'Juan López' } },
    { domain: 'contact', record_id: 'contact-1', score: 0.90, snippet: 'maria@acme.com — Product Manager', record: { display_name: 'María García' } },
    { domain: 'file', record_id: 'file-1', score: 0.68, snippet: '2.4 MB — Updated last week', record: { filename: 'Q3-report-final.pdf' } },
    { domain: 'diary', record_id: 'diary-1', score: 0.65, snippet: 'Hoy fue un buen día...', record: { entry_date: '2026-02-21', mood: 'good' } },
    { domain: 'conversation', record_id: 'conv-1', score: 0.70, snippet: "I've reviewed the Budget Q3...", record: { first_message: 'Budget Q3 review' } },
  ];

  if (!domains) {
    results.push(...otherResults);
  } else {
    const domainFilter = domains.replace(/s$/, '');
    results.push(...otherResults.filter(r => r.domain === domainFilter || `${r.domain}s` === domains));
  }

  return results.slice(0, 12);
}

// ── Mock router ──

let noteIdCounter = 100;

export function getMockResponse(method: string, path: string, body?: unknown): unknown {
  const url = path.split('?');
  const route = url[0]!;
  const params = new URLSearchParams(url[1] ?? '');

  // Auth
  if (method === 'POST' && route === '/auth/login') {
    return { data: { user: MOCK_USER, accessToken: 'mock-access-token-xyz', refreshToken: 'mock-refresh-token-xyz' } };
  }
  if (method === 'POST' && route === '/auth/refresh') {
    return { data: { accessToken: 'mock-access-token-new', refreshToken: 'mock-refresh-token-new' } };
  }

  // Agents
  if (method === 'GET' && route === '/agents') {
    return { data: MOCK_AGENTS };
  }

  // Conversations
  if (method === 'GET' && route.startsWith('/conversations')) {
    return { data: MOCK_CONVERSATIONS };
  }

  // Search
  if (method === 'GET' && route === '/search') {
    const q = params.get('q') ?? '';
    const domains = params.get('domains') ?? undefined;
    const results = getMockSearchResults(q, domains);
    return { data: results, meta: { total: results.length, limit: 12, offset: 0 } };
  }

  // ── Notes CRUD ──

  if (method === 'GET' && route === '/notes') {
    let filtered = mockNotes.filter(n => !n.deleted_at);
    const archived = params.get('archived') === 'true';
    filtered = filtered.filter(n => n.archived === archived);
    const search = params.get('search');
    if (search) filtered = filtered.filter(n => matchesQuery(n.title || '', search) || matchesQuery(n.content, search));
    const source = params.get('source');
    if (source) filtered = filtered.filter(n => n.source === source);
    const tag = params.get('tag');
    if (tag) filtered = filtered.filter(n => n.tags.includes(tag));
    const sort = params.get('sort') || 'updated_at';
    const order = params.get('order') || 'desc';
    filtered.sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[sort] ?? '');
      const bVal = String((b as unknown as Record<string, unknown>)[sort] ?? '');
      return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    });
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');
    return { data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } };
  }

  const noteGetMatch = route.match(/^\/notes\/([\w-]+)$/);
  if (method === 'GET' && noteGetMatch) {
    const note = mockNotes.find(n => n.id === noteGetMatch[1]);
    return note ? { data: note } : { data: null };
  }

  if (method === 'POST' && route === '/notes') {
    const input = body as Record<string, unknown>;
    const newNote: Note = {
      id: `note-${++noteIdCounter}`,
      title: (input.title as string) || null,
      content: (input.content as string) || '',
      content_format: (input.content_format as 'html') || 'html',
      source: 'local',
      source_id: null,
      tags: (input.tags as string[]) || [],
      pinned: (input.pinned as boolean) || false,
      archived: false,
      custom_fields: (input.custom_fields as Record<string, unknown>) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      deleted_at: null,
    };
    mockNotes.unshift(newNote);
    return { data: newNote };
  }

  const notePatchMatch = route.match(/^\/notes\/([\w-]+)$/);
  if (method === 'PATCH' && notePatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockNotes.findIndex(n => n.id === notePatchMatch[1]);
    if (idx !== -1) {
      mockNotes[idx] = { ...mockNotes[idx]!, ...input, updated_at: new Date().toISOString() } as Note;
      return { data: mockNotes[idx] };
    }
    return { data: null };
  }

  const noteDeleteMatch = route.match(/^\/notes\/([\w-]+)$/);
  if (method === 'DELETE' && noteDeleteMatch) {
    mockNotes = mockNotes.filter(n => n.id !== noteDeleteMatch[1]);
    return { data: { success: true } };
  }

  // Archive/unarchive/restore
  const noteActionMatch = route.match(/^\/notes\/([\w-]+)\/(archive|unarchive|restore)$/);
  if (method === 'POST' && noteActionMatch) {
    const [, id, action] = noteActionMatch;
    const idx = mockNotes.findIndex(n => n.id === id);
    if (idx !== -1) {
      if (action === 'archive') mockNotes[idx] = { ...mockNotes[idx]!, archived: true, updated_at: new Date().toISOString() };
      if (action === 'unarchive') mockNotes[idx] = { ...mockNotes[idx]!, archived: false, updated_at: new Date().toISOString() };
    }
    return { data: { success: true } };
  }

  // ── Entity Links ──

  if (method === 'GET' && route === '/links') {
    const entityId = params.get('entity_id');
    if (entityId) {
      const links = MOCK_LINKS.filter(l => l.source_id === entityId || l.target_id === entityId);
      return { data: links, meta: { total: links.length, limit: 20, offset: 0 } };
    }
    return { data: [], meta: { total: 0, limit: 20, offset: 0 } };
  }

  // Linked record enrichment
  const enrichMatch = route.match(/^\/(emails|events|contacts|files|diary)\/([\w-]+)$/);
  if (method === 'GET' && enrichMatch) {
    const record = MOCK_LINKED_RECORDS[enrichMatch[2]!];
    return { data: record || { id: enrichMatch[2] } };
  }

  return { data: null };
}

// ── Exported helpers ──

export function getMockConversations(): Conversation[] {
  return MOCK_CONVERSATIONS;
}

export function getMockMessages(conversationId: string): Message[] {
  return MOCK_MESSAGES[conversationId] ?? [];
}

export function getMockAgents(): Agent[] {
  return MOCK_AGENTS;
}

export function getMockUser(): User {
  return MOCK_USER;
}

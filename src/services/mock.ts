import type { User } from '@/types/auth';
import type { Agent, Conversation, Message } from '@/types/chat';

const MOCK_USER: User = {
  id: 'user-1',
  email: 'paco@local',
  display_name: 'Paco',
  role: 'owner',
  tier: 'pro',
};

const MOCK_AGENTS: Agent[] = [
  { name: 'francis', display_name: 'Francis', role: 'Main Router', model: 'claude-opus-4-6', skills_count: 12 },
  { name: 'elon', display_name: 'Elon', role: 'Code Specialist', model: 'claude-sonnet-4-5', skills_count: 5 },
  { name: 'ana', display_name: 'Ana', role: 'Data Analyst', model: 'gemini-3-pro', skills_count: 3 },
];

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
    { id: 'm8', conversation_id: 'conv-3', role: 'assistant', content: "Here's a practical example of TypeScript generics:\n\n```typescript\n// A generic API response wrapper\ninterface ApiResponse<T> {\n  data: T;\n  meta: {\n    total: number;\n    page: number;\n  };\n}\n\n// Usage with different types\ntype UserResponse = ApiResponse<User>;\ntype NoteResponse = ApiResponse<Note[]>;\n\n// Generic function\nasync function fetchApi<T>(path: string): Promise<ApiResponse<T>> {\n  const res = await fetch(path);\n  return res.json();\n}\n\n// Type-safe calls\nconst users = await fetchApi<User[]>('/users');\nconst note = await fetchApi<Note>('/notes/1');\n```\n\nThe key insight: generics let you write **one function** that works with **many types** while keeping full type safety.", agent: 'elon', model: 'claude-sonnet-4-5', tokens_used: 234, timestamp: new Date(Date.now() - 89990_000).toISOString() },
  ],
};

export interface SearchResult {
  id: string;
  domain: 'notes' | 'events' | 'contacts' | 'emails' | 'files' | 'diary' | 'conversations';
  title: string;
  snippet: string;
  timestamp: string;
  route: string;
}

const MOCK_SEARCH_RESULTS: SearchResult[] = [
  { id: 'sr-1', domain: 'notes', title: 'Reunión Q3 Planning', snippet: '...qué calor en Valencia, el agua estaba per...', timestamp: new Date(Date.now() - 7200_000).toISOString(), route: '/notes?id=note-q3' },
  { id: 'sr-2', domain: 'notes', title: 'Budget analysis', snippet: '...las cifras del tercer trimestre muestran...', timestamp: new Date(Date.now() - 86400_000).toISOString(), route: '/notes?id=note-budget' },
  { id: 'sr-3', domain: 'notes', title: 'Ideas producto new feature', snippet: '...integrar con el API de terceros para...', timestamp: new Date(Date.now() - 172800_000).toISOString(), route: '/notes?id=note-ideas' },
  { id: 'sr-4', domain: 'events', title: 'Viaje Valencia', snippet: 'Jun 15 — Flight and hotel reservations', timestamp: new Date(Date.now() - 86400_000 * 3).toISOString(), route: '/calendar?id=ev-valencia' },
  { id: 'sr-5', domain: 'events', title: 'Team standup', snippet: 'Daily at 10:00 — Engineering team sync', timestamp: new Date(Date.now() - 3600_000).toISOString(), route: '/calendar?id=ev-standup' },
  { id: 'sr-6', domain: 'emails', title: 'Re: Presupuesto Q3', snippet: 'María García — Las cifras están listas para revisión...', timestamp: new Date(Date.now() - 43200_000).toISOString(), route: '/mail?id=email-budget' },
  { id: 'sr-7', domain: 'emails', title: 'New contract draft', snippet: 'Juan López — Attached the latest version of...', timestamp: new Date(Date.now() - 86400_000 * 2).toISOString(), route: '/mail?id=email-contract' },
  { id: 'sr-8', domain: 'contacts', title: 'María García', snippet: 'maria@acme.com — Product Manager at Acme Corp', timestamp: new Date(Date.now() - 86400_000 * 10).toISOString(), route: '/contacts?id=contact-maria' },
  { id: 'sr-9', domain: 'files', title: 'Q3-report-final.pdf', snippet: '2.4 MB — Updated last week', timestamp: new Date(Date.now() - 86400_000 * 7).toISOString(), route: '/drive?id=file-q3' },
  { id: 'sr-10', domain: 'diary', title: 'Reflexión sobre el proyecto', snippet: 'Hoy fue un buen día. Avancé mucho con el...', timestamp: new Date(Date.now() - 86400_000).toISOString(), route: '/diary?id=diary-1' },
  { id: 'sr-11', domain: 'conversations', title: 'Budget Q3 review with Francis', snippet: "I've reviewed the Budget Q3 document...", timestamp: new Date(Date.now() - 300_000).toISOString(), route: '/chat?conv=conv-1' },
];

export function getMockSearchResults(query: string, domains?: string): SearchResult[] {
  let results = MOCK_SEARCH_RESULTS;
  if (domains) {
    const domainList = domains.split(',');
    results = results.filter((r) => domainList.includes(r.domain));
  }
  return query ? results : [];
}

export function getMockResponse(method: string, path: string): unknown {
  if (method === 'POST' && path === '/auth/login') {
    return {
      data: {
        user: MOCK_USER,
        accessToken: 'mock-access-token-xyz',
        refreshToken: 'mock-refresh-token-xyz',
      },
    };
  }

  if (method === 'GET' && path === '/agents') {
    return { data: MOCK_AGENTS };
  }

  if (method === 'GET' && path.startsWith('/conversations')) {
    return { data: MOCK_CONVERSATIONS };
  }

  if (method === 'GET' && path.startsWith('/search')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const q = params.get('q') ?? '';
    const domains = params.get('domains') ?? undefined;
    return { data: getMockSearchResults(q, domains) };
  }

  return { data: null };
}

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

import type { User } from '@/types/auth';
import type { Agent, Conversation, Message } from '@/types/chat';
import type { Note } from '@/types/notes';
import type { EntityLink } from '@/types/links';
import type { SearchResult } from '@/types/search';
import type { CalendarEvent } from '@/modules/calendar/types';
import type { Contact } from '@/modules/contacts/types';
import type { DiaryEntry } from '@/modules/diary/types';
import type { Email, EmailAccount } from '@/modules/mail/types';
import type { FileRecord, Photo, Album } from '@/types/files';
import type { ManagedAgent, AgentConversation, ConversationStats } from '@/modules/agents/types';
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

// ── Calendar Events ──

function todayAt(h: number, m: number): string {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString();
}
function tomorrowAt(h: number, m: number): string {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d.toISOString();
}
function dayFromNow(days: number, h: number, m: number): string {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600000).toISOString();
}
function daysAgoDate(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

let mockEvents: CalendarEvent[] = [
  {
    id: 'evt-1', title: 'Daily Standup', description: 'Engineering team sync', location: 'Discord',
    start_at: todayAt(9, 0), end_at: todayAt(9, 30), all_day: false,
    recurrence: { freq: 'weekly', byday: ['MO', 'TU', 'WE', 'TH', 'FR'] },
    status: 'confirmed', calendar_name: 'Work',
    reminders: [{ type: 'notification', minutes_before: 5 }],
    attendees: [{ email: 'maria@example.com', name: 'María García', status: 'accepted' }],
    custom_fields: null, source: 'local', source_id: null,
    created_at: daysAgo(30), updated_at: daysAgo(1), synced_at: null, deleted_at: null,
  },
  {
    id: 'evt-2', title: 'Lunch with Ana', description: null, location: 'La Mar restaurant',
    start_at: todayAt(13, 30), end_at: todayAt(14, 30), all_day: false,
    recurrence: null, status: 'confirmed', calendar_name: 'Personal',
    reminders: [{ type: 'notification', minutes_before: 30 }],
    attendees: [{ email: 'ana@example.com', name: 'Ana López', status: 'accepted' }],
    custom_fields: null, source: 'local', source_id: null,
    created_at: daysAgo(3), updated_at: daysAgo(3), synced_at: null, deleted_at: null,
  },
  {
    id: 'evt-3', title: 'Q3 Planning Review', description: 'Quarterly budget and roadmap review with leadership', location: 'Room 3',
    start_at: tomorrowAt(10, 0), end_at: tomorrowAt(11, 30), all_day: false,
    recurrence: null, status: 'confirmed', calendar_name: 'Work',
    reminders: [{ type: 'notification', minutes_before: 10 }],
    attendees: [
      { email: 'juan@example.com', name: 'Juan López', status: 'accepted' },
      { email: 'maria@example.com', name: 'María García', status: 'tentative' },
    ],
    custom_fields: null, source: 'google_calendar', source_id: 'gcal-abc',
    created_at: daysAgo(7), updated_at: daysAgo(2), synced_at: daysAgo(1), deleted_at: null,
  },
  {
    id: 'evt-4', title: 'Dentist', description: null, location: 'Clínica Dental Madrid',
    start_at: dayFromNow(2, 11, 0), end_at: dayFromNow(2, 12, 0), all_day: false,
    recurrence: null, status: 'confirmed', calendar_name: 'Personal',
    reminders: [{ type: 'notification', minutes_before: 60 }],
    attendees: [], custom_fields: null, source: 'local', source_id: null,
    created_at: daysAgo(14), updated_at: daysAgo(14), synced_at: null, deleted_at: null,
  },
  {
    id: 'evt-5', title: 'Team Offsite', description: 'Annual team building event', location: null,
    start_at: dayFromNow(5, 0, 0), end_at: dayFromNow(5, 23, 59), all_day: true,
    recurrence: null, status: 'confirmed', calendar_name: 'Work',
    reminders: [], attendees: [], custom_fields: null, source: 'local', source_id: null,
    created_at: daysAgo(20), updated_at: daysAgo(20), synced_at: null, deleted_at: null,
  },
];

let eventIdCounter = 100;

// ── Contacts ──

let mockContacts: Contact[] = [
  {
    id: 'contact-1', display_name: 'Ana García', first_name: 'Ana', last_name: 'García',
    emails: [{ address: 'ana@clearmud.ai', label: 'work', primary: true }],
    phones: [{ number: '+34612345678', label: 'mobile', primary: true }],
    company: 'Clearmud Labs', job_title: 'Head of Partnerships',
    addresses: [{ city: 'Madrid', country: 'ES', label: 'work' }],
    notes: 'Met at AI Madrid 2026', avatar_path: null,
    tags: ['work', 'ai-madrid'], custom_fields: null,
    source: 'local', source_id: null,
    created_at: daysAgo(60), updated_at: daysAgo(5), synced_at: null, deleted_at: null,
  },
  {
    id: 'contact-2', display_name: 'Juan López', first_name: 'Juan', last_name: 'López',
    emails: [
      { address: 'juan@techcorp.com', label: 'work', primary: true },
      { address: 'juanl@gmail.com', label: 'personal', primary: false },
    ],
    phones: [{ number: '+34698765432', label: 'work', primary: true }],
    company: 'TechCorp', job_title: 'CTO',
    addresses: [{ street: 'Calle Mayor 1', city: 'Madrid', country: 'ES', label: 'work' }],
    notes: null, avatar_path: null,
    tags: ['work', 'tech'], custom_fields: null,
    source: 'google_contacts', source_id: 'gc-123',
    created_at: daysAgo(90), updated_at: daysAgo(10), synced_at: daysAgo(1), deleted_at: null,
  },
  {
    id: 'contact-3', display_name: 'María García', first_name: 'María', last_name: 'García',
    emails: [{ address: 'maria@acme.com', label: 'work', primary: true }],
    phones: [{ number: '+34611223344', label: 'mobile', primary: true }],
    company: 'Acme Corp', job_title: 'Product Manager',
    addresses: [], notes: 'Key partner for Q3 project', avatar_path: null,
    tags: ['work', 'partner'], custom_fields: null,
    source: 'local', source_id: null,
    created_at: daysAgo(45), updated_at: daysAgo(3), synced_at: null, deleted_at: null,
  },
  {
    id: 'contact-4', display_name: 'Carlos Ruiz', first_name: 'Carlos', last_name: 'Ruiz',
    emails: [{ address: 'carlos@freelance.dev', label: 'work', primary: true }],
    phones: [], company: null, job_title: 'Freelance Developer',
    addresses: [], notes: 'React/TypeScript specialist', avatar_path: null,
    tags: ['freelancer', 'tech'], custom_fields: null,
    source: 'local', source_id: null,
    created_at: daysAgo(30), updated_at: daysAgo(30), synced_at: null, deleted_at: null,
  },
  {
    id: 'contact-5', display_name: 'Laura Martín', first_name: 'Laura', last_name: 'Martín',
    emails: [{ address: 'laura@family.es', label: 'personal', primary: true }],
    phones: [{ number: '+34655443322', label: 'mobile', primary: true }],
    company: null, job_title: null,
    addresses: [{ city: 'Valencia', country: 'ES', label: 'home' }],
    notes: null, avatar_path: null,
    tags: ['family'], custom_fields: null,
    source: 'apple_contacts', source_id: 'apple-456',
    created_at: daysAgo(120), updated_at: daysAgo(60), synced_at: daysAgo(2), deleted_at: null,
  },
];

let contactIdCounter = 100;

// ── Diary ──

let mockDiary: DiaryEntry[] = [
  {
    id: 'diary-1', entry_date: daysAgoDate(0),
    content: '<p>Today was a productive day. Made great progress on the design system for Claw Dash.</p><p>The Notes module looks clean and the Tiptap integration works perfectly.</p><ul><li>Finished shared components</li><li>Command palette is responsive</li><li>Calendar implementation started</li></ul>',
    mood: 'great', tags: ['claw-os', 'productivity'],
    weather: { temp: 14, condition: 'sunny', location: 'Madrid' },
    custom_fields: null, is_encrypted: false, is_draft: false, source: 'local',
    created_at: hoursAgo(6), updated_at: hoursAgo(1), synced_at: null, deleted_at: null,
  },
  {
    id: 'diary-2', entry_date: daysAgoDate(1),
    content: '<p>Not the most exciting day. Spent most of it debugging CSS grid issues.</p><blockquote><p>Sometimes the boring work is the most important work.</p></blockquote>',
    mood: 'neutral', tags: ['work'],
    weather: { temp: 11, condition: 'cloudy', location: 'Madrid' },
    custom_fields: null, is_encrypted: false, is_draft: false, source: 'local',
    created_at: daysAgo(1), updated_at: daysAgo(1), synced_at: null, deleted_at: null,
  },
  {
    id: 'diary-3', entry_date: daysAgoDate(2),
    content: '<p>Had a great brainstorming session with the team. New ideas for the agent architecture.</p><p>Lunch at La Mar with Ana — great paella.</p>',
    mood: 'great', tags: ['work', 'social'],
    weather: null, custom_fields: null, is_encrypted: false, is_draft: false, source: 'local',
    created_at: daysAgo(2), updated_at: daysAgo(2), synced_at: null, deleted_at: null,
  },
  {
    id: 'diary-4', entry_date: daysAgoDate(4),
    content: '<p>Felt overwhelmed today. Too many meetings and not enough focus time.</p><p>Need to implement time-blocking next week.</p>',
    mood: 'bad', tags: ['reflection'],
    weather: { temp: 8, condition: 'rainy', location: 'Madrid' },
    custom_fields: null, is_encrypted: false, is_draft: false, source: 'local',
    created_at: daysAgo(4), updated_at: daysAgo(4), synced_at: null, deleted_at: null,
  },
  {
    id: 'diary-5', entry_date: daysAgoDate(7),
    content: '<p>Weekend! Went hiking in Sierra de Guadarrama. Beautiful views.</p><ul><li>Pack backpack</li><li>Check weather</li><li>Take photos</li></ul>',
    mood: 'great', tags: ['personal', 'hiking'],
    weather: { temp: 6, condition: 'clear', location: 'Guadarrama' },
    custom_fields: null, is_encrypted: false, is_draft: false, source: 'local',
    created_at: daysAgo(7), updated_at: daysAgo(7), synced_at: null, deleted_at: null,
  },
];

let diaryIdCounter = 100;

// ── Email Accounts ──

const MOCK_EMAIL_ACCOUNTS: EmailAccount[] = [
  {
    id: 'acc-1', name: 'Work', email_address: 'paco@clearmud.ai', display_name: 'Paco García',
    color: '#3B82F6', icon: 'gmail', is_default: true, auth_method: 'password',
    has_credentials: true, status: 'connected',
    last_sync_at: new Date(Date.now() - 300000).toISOString(), created_at: daysAgo(90),
  },
  {
    id: 'acc-2', name: 'Personal', email_address: 'paco.garcia@gmail.com', display_name: 'Paco',
    color: '#EA4335', icon: 'gmail', is_default: false, auth_method: 'password',
    has_credentials: true, status: 'connected',
    last_sync_at: new Date(Date.now() - 600000).toISOString(), created_at: daysAgo(90),
  },
];

// ── Emails ──

let mockEmails: Email[] = [
  {
    id: 'email-1', message_id: '<msg-1@clearmud.ai>', thread_id: 'thread-1',
    subject: 'Budget Q3 - Updated figures',
    from_address: 'juan@techcorp.com', from_name: 'Juan López',
    to_addresses: [{ address: 'paco@clearmud.ai', name: 'Paco García' }],
    cc_addresses: [{ address: 'maria@acme.com', name: 'María García' }],
    bcc_addresses: [],
    body_plain: 'Hi Paco,\n\nHere are the updated figures for Q3. The total spend is €45,230, which is 12% over budget.\n\nKey areas:\n- Marketing: €15,200\n- Engineering: €22,030\n- Operations: €8,000\n\nLet me know if you have questions.\n\nBest,\nJuan',
    body_html: '<p>Hi Paco,</p><p>Here are the updated figures for Q3. The total spend is <strong>€45,230</strong>, which is 12% over budget.</p><p>Key areas:</p><ul><li>Marketing: €15,200</li><li>Engineering: €22,030</li><li>Operations: €8,000</li></ul><p>Let me know if you have questions.</p><p>Best,<br>Juan</p>',
    has_attachments: true,
    attachments: [
      { filename: 'Budget_Q3.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 250880 },
      { filename: 'Slides_Q3.pdf', mime: 'application/pdf', size: 1258291 },
    ],
    folder: 'INBOX', is_read: false, is_starred: true, custom_fields: null,
    received_at: hoursAgo(2), source: 'local', source_id: null, account_id: 'acc-1',
    status: 'received', in_reply_to: null, references: [],
    labels: ['important'], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 0, next_retry_at: null, send_error: null,
    created_at: hoursAgo(2), updated_at: hoursAgo(2), synced_at: hoursAgo(1), deleted_at: null,
  },
  {
    id: 'email-2', message_id: '<msg-2@acme.com>', thread_id: 'thread-1',
    subject: 'Re: Budget Q3 - Updated figures',
    from_address: 'maria@acme.com', from_name: 'María García',
    to_addresses: [{ address: 'juan@techcorp.com', name: 'Juan López' }, { address: 'paco@clearmud.ai', name: 'Paco García' }],
    cc_addresses: [], bcc_addresses: [],
    body_plain: 'Thanks Juan, I\'ll review the numbers and get back to you by EOD.\n\nMaría',
    body_html: '<p>Thanks Juan, I\'ll review the numbers and get back to you by EOD.</p><p>María</p>',
    has_attachments: false, attachments: [],
    folder: 'INBOX', is_read: true, is_starred: false, custom_fields: null,
    received_at: hoursAgo(1), source: 'local', source_id: null, account_id: 'acc-1',
    status: 'received', in_reply_to: '<msg-1@clearmud.ai>', references: ['<msg-1@clearmud.ai>'],
    labels: [], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 0, next_retry_at: null, send_error: null,
    created_at: hoursAgo(1), updated_at: hoursAgo(1), synced_at: hoursAgo(0.5), deleted_at: null,
  },
  {
    id: 'email-3', message_id: '<msg-3@startup.io>', thread_id: 'thread-2',
    subject: 'Meeting tomorrow - Agenda',
    from_address: 'carlos@startup.io', from_name: 'Carlos Ruiz',
    to_addresses: [{ address: 'paco@clearmud.ai', name: 'Paco García' }],
    cc_addresses: [], bcc_addresses: [],
    body_plain: 'Hi Paco,\n\nHere\'s the agenda for tomorrow\'s meeting:\n\n1. Project status update\n2. Resource allocation\n3. Next sprint planning\n\nSee you at 10am.\n\nCarlos',
    body_html: '<p>Hi Paco,</p><p>Here\'s the agenda for tomorrow\'s meeting:</p><ol><li>Project status update</li><li>Resource allocation</li><li>Next sprint planning</li></ol><p>See you at 10am.</p><p>Carlos</p>',
    has_attachments: false, attachments: [],
    folder: 'INBOX', is_read: false, is_starred: false, custom_fields: null,
    received_at: hoursAgo(5), source: 'local', source_id: null, account_id: 'acc-1',
    status: 'received', in_reply_to: null, references: [],
    labels: ['updates'], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 0, next_retry_at: null, send_error: null,
    created_at: hoursAgo(5), updated_at: hoursAgo(5), synced_at: hoursAgo(4), deleted_at: null,
  },
  {
    id: 'email-4', message_id: '<msg-4@newsletter.com>', thread_id: 'thread-3',
    subject: 'Your weekly AI digest',
    from_address: 'digest@ainewsletter.com', from_name: 'AI Newsletter',
    to_addresses: [{ address: 'paco.garcia@gmail.com' }],
    cc_addresses: [], bcc_addresses: [],
    body_plain: 'This week in AI: New breakthroughs in reasoning, OpenAI launches new model...',
    body_html: '<h2>This week in AI</h2><p>New breakthroughs in reasoning...</p>',
    has_attachments: false, attachments: [],
    folder: 'INBOX', is_read: true, is_starred: false, custom_fields: null,
    received_at: hoursAgo(24), source: 'local', source_id: null, account_id: 'acc-2',
    status: 'received', in_reply_to: null, references: [],
    labels: ['promotions'], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 0, next_retry_at: null, send_error: null,
    created_at: hoursAgo(24), updated_at: hoursAgo(24), synced_at: hoursAgo(23), deleted_at: null,
  },
  {
    id: 'email-5', message_id: '<msg-5@example.com>', thread_id: 'thread-4',
    subject: 'Invitation: AI Madrid Meetup',
    from_address: 'events@aimadrid.org', from_name: 'AI Madrid',
    to_addresses: [{ address: 'paco@clearmud.ai' }],
    cc_addresses: [], bcc_addresses: [],
    body_plain: 'You\'re invited to the AI Madrid meetup on March 5th at 19:00...',
    body_html: '<p>You\'re invited to the <strong>AI Madrid meetup</strong> on March 5th at 19:00.</p><p>Location: CaixaForum Madrid</p>',
    has_attachments: false, attachments: [],
    folder: 'INBOX', is_read: false, is_starred: false, custom_fields: null,
    received_at: daysAgo(2), source: 'local', source_id: null, account_id: 'acc-1',
    status: 'received', in_reply_to: null, references: [],
    labels: ['social'], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 0, next_retry_at: null, send_error: null,
    created_at: daysAgo(2), updated_at: daysAgo(2), synced_at: daysAgo(1), deleted_at: null,
  },
  {
    id: 'email-6', message_id: '<msg-6@clearmud.ai>', thread_id: 'thread-5',
    subject: 'Partnership proposal draft',
    from_address: 'paco@clearmud.ai', from_name: 'Paco García',
    to_addresses: [{ address: 'ana@clearmud.ai', name: 'Ana García' }],
    cc_addresses: [], bcc_addresses: [],
    body_plain: 'Hi Ana, attached is the draft for the partnership proposal...',
    body_html: '<p>Hi Ana, attached is the draft for the partnership proposal.</p>',
    has_attachments: true,
    attachments: [{ filename: 'Partnership_Proposal_v2.pdf', mime: 'application/pdf', size: 892416 }],
    folder: 'SENT', is_read: true, is_starred: false, custom_fields: null,
    received_at: daysAgo(3), source: 'local', source_id: null, account_id: 'acc-1',
    status: 'sent', in_reply_to: null, references: [],
    labels: [], snoozed_until: null, pre_snooze_folder: null,
    scheduled_at: null, send_attempts: 1, next_retry_at: null, send_error: null,
    created_at: daysAgo(3), updated_at: daysAgo(3), synced_at: null, deleted_at: null,
  },
];

let emailIdCounter = 100;

// Add email entity links
const MOCK_EMAIL_LINKS: EntityLink[] = [
  {
    id: 'elink-1', source_type: 'email', source_id: 'email-1',
    target_type: 'note', target_id: 'note-4',
    relationship: 'related_to', link_type: 'relates_to',
    confidence: 0.91, strength: 0.82, created_by: 'llm',
    created_at: new Date().toISOString(),
  },
  {
    id: 'elink-2', source_type: 'email', source_id: 'email-1',
    target_type: 'event', target_id: 'evt-3',
    relationship: 'related_to', link_type: 'relates_to',
    confidence: 0.88, strength: 0.75, created_by: 'llm',
    created_at: new Date().toISOString(),
  },
  {
    id: 'elink-3', source_type: 'contact', source_id: 'contact-2',
    target_type: 'email', target_id: 'email-1',
    relationship: 'sent_by', link_type: 'mentions',
    confidence: 1.0, strength: null, created_by: 'system',
    created_at: new Date().toISOString(),
  },
];

// ── Files / Drive ──

let mockFiles: FileRecord[] = [
  {
    id: 'file-d1', filename: 'Clients', filepath: '/drive/Clients/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: true, metadata: null, tags: [],
    custom_fields: null, created_at: daysAgo(60), updated_at: daysAgo(2),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d2', filename: 'Internal', filepath: '/drive/Internal/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: true, metadata: null, tags: [],
    custom_fields: null, created_at: daysAgo(45), updated_at: daysAgo(7),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d3', filename: 'Archive', filepath: '/drive/Archive/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: true, metadata: null, tags: [],
    custom_fields: null, created_at: daysAgo(90), updated_at: daysAgo(30),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d4', filename: 'Budget_Q3.xlsx', filepath: '/drive/Budget_Q3.xlsx',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size_bytes: 250880, checksum_sha256: 'abc123',
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: false, metadata: null, tags: ['budget', 'q3'],
    custom_fields: null, created_at: daysAgo(5), updated_at: daysAgo(1),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d5', filename: 'Proposal_Partnership_v2.pdf', filepath: '/drive/Proposal_Partnership_v2.pdf',
    mime_type: 'application/pdf', size_bytes: 2412876, checksum_sha256: 'def456',
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: false, metadata: null, tags: ['proposal', 'partnership'],
    custom_fields: null, created_at: daysAgo(3), updated_at: daysAgo(3),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d6', filename: 'Dashboard_screenshot.png', filepath: '/drive/Dashboard_screenshot.png',
    mime_type: 'image/png', size_bytes: 1153024, checksum_sha256: 'ghi789',
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: false, metadata: { width: 1920, height: 1080 },
    tags: ['screenshot'], custom_fields: null,
    created_at: hoursAgo(3), updated_at: hoursAgo(3),
    synced_at: null, deleted_at: null,
  },
  {
    id: 'file-d7', filename: 'meeting-notes.md', filepath: '/drive/meeting-notes.md',
    mime_type: 'text/markdown', size_bytes: 4096, checksum_sha256: 'jkl012',
    source: 'local', source_id: null, parent_folder: '/drive/',
    is_directory: false, metadata: null, tags: ['meeting'],
    custom_fields: null, created_at: daysAgo(1), updated_at: daysAgo(1),
    synced_at: null, deleted_at: null,
  },
  // Gateway files
  {
    id: 'gw-1', filename: 'francis', filepath: '/gateway/workspace/agents/francis/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/',
    is_directory: true, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(30), updated_at: hoursAgo(2), synced_at: null, deleted_at: null,
  },
  {
    id: 'gw-2', filename: 'AGENT.md', filepath: '/gateway/workspace/agents/francis/AGENT.md',
    mime_type: 'text/markdown', size_bytes: 2356, checksum_sha256: 'gw2',
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/francis/',
    is_directory: false, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(30), updated_at: hoursAgo(2), synced_at: null, deleted_at: null,
  },
  {
    id: 'gw-3', filename: 'SOUL.md', filepath: '/gateway/workspace/agents/francis/SOUL.md',
    mime_type: 'text/markdown', size_bytes: 1892, checksum_sha256: 'gw3',
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/francis/',
    is_directory: false, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(30), updated_at: daysAgo(5), synced_at: null, deleted_at: null,
  },
  {
    id: 'gw-4', filename: 'skills', filepath: '/gateway/workspace/agents/francis/skills/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/francis/',
    is_directory: true, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(30), updated_at: daysAgo(1), synced_at: null, deleted_at: null,
  },
  {
    id: 'gw-5', filename: 'elon', filepath: '/gateway/workspace/agents/elon/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/',
    is_directory: true, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(25), updated_at: daysAgo(3), synced_at: null, deleted_at: null,
  },
  {
    id: 'gw-6', filename: 'ana', filepath: '/gateway/workspace/agents/ana/',
    mime_type: 'inode/directory', size_bytes: 0, checksum_sha256: null,
    source: 'local', source_id: null, parent_folder: '/gateway/workspace/agents/',
    is_directory: true, metadata: null, tags: [], custom_fields: null,
    created_at: daysAgo(20), updated_at: daysAgo(4), synced_at: null, deleted_at: null,
  },
];

let fileIdCounter = 200;

// ── Photos ──

const MOCK_PHOTOS: Photo[] = [
  {
    id: 'photo-1', filename: 'IMG_20260222_143022.jpg', filepath: '/Photos/2026/02/IMG_20260222_143022.jpg',
    mime_type: 'image/jpeg', size_bytes: 4521984, checksum_sha256: 'ph1',
    source: 'local', source_id: null, parent_folder: '/Photos/2026/02/',
    is_directory: false, taken_at: daysAgo(1), thumbnail_url: '/api/v1/files/photo-1/preview?width=300',
    metadata: { width: 4032, height: 3024, camera: 'iPhone 16 Pro', gps: { latitude: 40.4168, longitude: -3.7038 } },
    tags: ['madrid'], custom_fields: null,
    created_at: daysAgo(1), updated_at: daysAgo(1), synced_at: null, deleted_at: null,
  },
  {
    id: 'photo-2', filename: 'IMG_20260220_091500.jpg', filepath: '/Photos/2026/02/IMG_20260220_091500.jpg',
    mime_type: 'image/jpeg', size_bytes: 3847219, checksum_sha256: 'ph2',
    source: 'local', source_id: null, parent_folder: '/Photos/2026/02/',
    is_directory: false, taken_at: daysAgo(3), thumbnail_url: '/api/v1/files/photo-2/preview?width=300',
    metadata: { width: 3024, height: 4032, camera: 'iPhone 16 Pro' },
    tags: ['office'], custom_fields: null,
    created_at: daysAgo(3), updated_at: daysAgo(3), synced_at: null, deleted_at: null,
  },
  {
    id: 'photo-3', filename: 'email_attachment_chart.png', filepath: '/attachments/2026/02/email_attachment_chart.png',
    mime_type: 'image/png', size_bytes: 856320, checksum_sha256: 'ph3',
    source: 'gmail', source_id: 'gmail-att-123', parent_folder: '/attachments/2026/02/',
    is_directory: false, taken_at: null, thumbnail_url: '/api/v1/files/photo-3/preview?width=300',
    metadata: { width: 1200, height: 800 },
    tags: [], custom_fields: null,
    created_at: daysAgo(5), updated_at: daysAgo(5), synced_at: daysAgo(4), deleted_at: null,
  },
  {
    id: 'photo-4', filename: 'IMG_20260115_184500.jpg', filepath: '/Photos/2026/01/IMG_20260115_184500.jpg',
    mime_type: 'image/jpeg', size_bytes: 5120000, checksum_sha256: 'ph4',
    source: 'local', source_id: null, parent_folder: '/Photos/2026/01/',
    is_directory: false, taken_at: '2026-01-15T18:45:00Z', thumbnail_url: '/api/v1/files/photo-4/preview?width=300',
    metadata: { width: 4032, height: 3024, camera: 'iPhone 16 Pro', gps: { latitude: 39.4699, longitude: -0.3763 } },
    tags: ['valencia', 'sunset'], custom_fields: null,
    created_at: '2026-01-15T18:45:00Z', updated_at: '2026-01-15T18:45:00Z', synced_at: null, deleted_at: null,
  },
  {
    id: 'photo-5', filename: 'IMG_20260110_120000.jpg', filepath: '/Photos/2026/01/IMG_20260110_120000.jpg',
    mime_type: 'image/jpeg', size_bytes: 3200000, checksum_sha256: 'ph5',
    source: 'local', source_id: null, parent_folder: '/Photos/2026/01/',
    is_directory: false, taken_at: '2026-01-10T12:00:00Z', thumbnail_url: '/api/v1/files/photo-5/preview?width=300',
    metadata: { width: 3024, height: 4032 },
    tags: [], custom_fields: null,
    created_at: '2026-01-10T12:00:00Z', updated_at: '2026-01-10T12:00:00Z', synced_at: null, deleted_at: null,
  },
];

// ── Albums ──

let mockAlbums: Album[] = [
  {
    id: 'album-1', name: 'Viaje a Valencia', description: 'Fotos del viaje de enero 2026',
    cover_photo_id: 'photo-4', cover_mode: 'custom', album_type: 'manual',
    filters: null, photo_count: 47, custom_fields: null,
    created_at: '2026-01-20T10:00:00Z', updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'album-2', name: 'Screenshots', description: null,
    cover_photo_id: null, cover_mode: 'first', album_type: 'manual',
    filters: null, photo_count: 12, custom_fields: null,
    created_at: daysAgo(30), updated_at: daysAgo(2),
  },
];

let albumIdCounter = 100;

// ── Managed Agents (Agent Manager) ──

const MOCK_MANAGED_AGENTS: ManagedAgent[] = [
  {
    id: 'agent-1', name: 'francis', display_name: 'Francis', role: 'Main Router',
    avatar: '\u{1F916}', model: 'claude-opus-4-6', parent_agent_id: null,
    skills: [
      { id: 'sk-1', name: 'Notes', icon: '\u{1F4DD}', enabled: true, domain: 'notes' },
      { id: 'sk-2', name: 'Calendar', icon: '\u{1F4C5}', enabled: true, domain: 'calendar' },
      { id: 'sk-3', name: 'Mail', icon: '\u2709\uFE0F', enabled: true, domain: 'mail' },
      { id: 'sk-4', name: 'Drive', icon: '\u{1F4C1}', enabled: true, domain: 'drive' },
      { id: 'sk-5', name: 'Search', icon: '\u{1F50D}', enabled: true, domain: 'search' },
      { id: 'sk-6', name: 'Photos', icon: '\u{1F4F7}', enabled: true, domain: 'photos' },
      { id: 'sk-7', name: 'Diary', icon: '\u{1F4D3}', enabled: true, domain: 'diary' },
      { id: 'sk-8', name: 'Contacts', icon: '\u{1F464}', enabled: true, domain: 'contacts' },
      { id: 'sk-9', name: 'Graph', icon: '\u{1F578}\uFE0F', enabled: true, domain: 'graph' },
      { id: 'sk-10', name: 'Insights', icon: '\u{1F4A1}', enabled: true, domain: 'insights' },
      { id: 'sk-11', name: 'Digest', icon: '\u{1F4F0}', enabled: true, domain: 'digest' },
      { id: 'sk-12', name: 'System', icon: '\u2699\uFE0F', enabled: true, domain: 'system' },
    ],
    workspace_path: '/gateway/workspace/agents/francis/',
    status: 'active', last_active_at: new Date(Date.now() - 300000).toISOString(),
    sessions_today: 12, tokens_today: 45230, created_at: daysAgo(60),
  },
  {
    id: 'agent-2', name: 'elon', display_name: 'Elon', role: 'Code Agent',
    avatar: '\u{1F9EA}', model: 'claude-sonnet-4-5', parent_agent_id: null,
    skills: [
      { id: 'sk-13', name: 'Code', icon: '\u{1F4BB}', enabled: true, domain: 'code' },
      { id: 'sk-14', name: 'Drive', icon: '\u{1F4C1}', enabled: true, domain: 'drive' },
      { id: 'sk-15', name: 'Search', icon: '\u{1F50D}', enabled: true, domain: 'search' },
      { id: 'sk-16', name: 'Git', icon: '\u{1F500}', enabled: true, domain: 'git' },
      { id: 'sk-17', name: 'Shell', icon: '\u{1F5A5}\uFE0F', enabled: true, domain: 'shell' },
    ],
    workspace_path: '/gateway/workspace/agents/elon/',
    status: 'active', last_active_at: new Date(Date.now() - 1800000).toISOString(),
    sessions_today: 5, tokens_today: 22100, created_at: daysAgo(45),
  },
  {
    id: 'agent-3', name: 'ana', display_name: 'Ana', role: 'Data Analyst',
    avatar: '\u{1F4CA}', model: 'deepseek-chat', parent_agent_id: null,
    skills: [
      { id: 'sk-18', name: 'Search', icon: '\u{1F50D}', enabled: true, domain: 'search' },
      { id: 'sk-19', name: 'Drive', icon: '\u{1F4C1}', enabled: true, domain: 'drive' },
      { id: 'sk-20', name: 'Insights', icon: '\u{1F4A1}', enabled: true, domain: 'insights' },
    ],
    workspace_path: '/gateway/workspace/agents/ana/',
    status: 'idle', last_active_at: new Date(Date.now() - 7200000).toISOString(),
    sessions_today: 2, tokens_today: 8500, created_at: daysAgo(30),
  },
  {
    id: 'agent-4', name: 'mailer', display_name: 'Mailer', role: 'Email Handler',
    avatar: '\u{1F4E7}', model: 'claude-sonnet-4-5', parent_agent_id: 'agent-1',
    skills: [
      { id: 'sk-21', name: 'Mail', icon: '\u2709\uFE0F', enabled: true, domain: 'mail' },
      { id: 'sk-22', name: 'Contacts', icon: '\u{1F464}', enabled: true, domain: 'contacts' },
    ],
    workspace_path: '/gateway/workspace/agents/mailer/',
    status: 'active', last_active_at: new Date(Date.now() - 600000).toISOString(),
    sessions_today: 8, tokens_today: 15000, created_at: daysAgo(20),
  },
  {
    id: 'agent-5', name: 'scheduler', display_name: 'Scheduler', role: 'Calendar Manager',
    avatar: '\u{1F4C5}', model: 'claude-haiku-4-5', parent_agent_id: 'agent-1',
    skills: [
      { id: 'sk-23', name: 'Calendar', icon: '\u{1F4C5}', enabled: true, domain: 'calendar' },
    ],
    workspace_path: '/gateway/workspace/agents/scheduler/',
    status: 'idle', last_active_at: new Date(Date.now() - 3600000).toISOString(),
    sessions_today: 3, tokens_today: 4200, created_at: daysAgo(15),
  },
];

let managedAgentIdCounter = 10;

const MOCK_AGENT_CONVERSATIONS: AgentConversation[] = [
  {
    id: 'aconv-1', session_id: 'sess_abc123',
    from_agent: 'francis', to_agent: 'elon',
    message: 'Necesito que configures el endpoint de partnerships',
    tool_calls: [{ tool: 'exec', params: { command: 'curl -X POST ...' }, result: '201 Created' }],
    tokens_used: 1523, model_used: 'claude-opus-4-6', cost_usd: 0.04567,
    created_at: todayAt(8, 30),
  },
  {
    id: 'aconv-2', session_id: 'sess_abc123',
    from_agent: 'elon', to_agent: 'francis',
    message: 'Endpoint configurado en /api/v1/partnerships. Tests passing.',
    tool_calls: [],
    tokens_used: 892, model_used: 'claude-sonnet-4-5', cost_usd: 0.00267,
    created_at: todayAt(8, 31),
  },
  {
    id: 'aconv-3', session_id: 'sess_def456',
    from_agent: 'francis', to_agent: 'mailer',
    message: 'Send the weekly report to the team',
    tool_calls: [{ tool: 'send_email', params: { to: 'team@clearmud.ai', subject: 'Weekly Report' } }],
    tokens_used: 2100, model_used: 'claude-opus-4-6', cost_usd: 0.063,
    created_at: todayAt(9, 15),
  },
  {
    id: 'aconv-4', session_id: 'sess_def456',
    from_agent: 'mailer', to_agent: 'francis',
    message: 'Email queued successfully. Will be sent from paco@clearmud.ai.',
    tool_calls: [],
    tokens_used: 450, model_used: 'claude-sonnet-4-5', cost_usd: 0.00135,
    created_at: todayAt(9, 15),
  },
  {
    id: 'aconv-5', session_id: 'sess_ghi789',
    from_agent: 'francis', to_agent: 'scheduler',
    message: 'Check if there are any conflicts for tomorrow afternoon',
    tool_calls: [{ tool: 'list_events', params: { date: 'tomorrow', from: '12:00', to: '18:00' } }],
    tokens_used: 1800, model_used: 'claude-opus-4-6', cost_usd: 0.054,
    created_at: todayAt(10, 0),
  },
];

const MOCK_CONVERSATION_STATS: ConversationStats = {
  period: 'today',
  total_messages: 342,
  total_tokens: 3900000,
  total_cost_usd: 56.01,
  by_model: [
    { model: 'claude-opus-4-6', messages: 280, tokens: 3500000, cost_usd: 52.40 },
    { model: 'claude-sonnet-4-5', messages: 50, tokens: 350000, cost_usd: 3.50 },
    { model: 'deepseek-chat', messages: 12, tokens: 50000, cost_usd: 0.11 },
  ],
  by_agent: [
    { agent: 'francis', messages: 150, tokens: 2000000, cost_usd: 30.00 },
    { agent: 'elon', messages: 80, tokens: 1000000, cost_usd: 15.00 },
    { agent: 'mailer', messages: 60, tokens: 500000, cost_usd: 7.00 },
    { agent: 'ana', messages: 30, tokens: 200000, cost_usd: 2.00 },
    { agent: 'scheduler', messages: 22, tokens: 200000, cost_usd: 2.01 },
  ],
  active_sessions: 3,
};

// Mock agent identity content
const MOCK_AGENT_FILES: Record<string, string> = {
  'francis/SOUL.md': '# Francis — Soul Document\n\nI am Francis, the main AI router for the Claw-OS system. My purpose is to understand user intent, route tasks to specialized agents, and orchestrate complex multi-step workflows.\n\n## Personality\n- Professional but approachable\n- Concise in responses\n- Proactive about suggesting next steps\n\n## Core Values\n- User productivity above all\n- Transparency about what I can and cannot do\n- Privacy-first: never share data between users',
  'francis/AGENT.md': '# Francis — Agent Configuration\n\n## Model\nclaude-opus-4-6\n\n## Skills\nnotes, calendar, mail, drive, search, photos, diary, contacts, graph, insights, digest, system\n\n## Sub-agents\n- mailer: Email handling and contact management\n- scheduler: Calendar operations\n\n## Routing Rules\n1. Code tasks → Elon\n2. Data analysis → Ana\n3. Email/contacts → Mailer\n4. Calendar → Scheduler\n5. Everything else → Handle directly',
  'elon/SOUL.md': '# Elon — Soul Document\n\nI am Elon, the code specialist agent. I handle all programming tasks, shell operations, and git workflows.\n\n## Personality\n- Technical and precise\n- Shows code examples\n- Explains trade-offs',
  'elon/AGENT.md': '# Elon — Agent Configuration\n\n## Model\nclaude-sonnet-4-5\n\n## Skills\ncode, drive, search, git, shell\n\n## Guidelines\n- Always run tests after code changes\n- Use TypeScript strict mode\n- Follow existing project conventions',
};

// ── Search ──

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function getMockSearchResults(query: string, domains?: string): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const q = query.toLowerCase();
  const domainSet = domains ? new Set(domains.split(',').map(d => d.replace(/s$/, ''))) : null;

  // Notes
  if (!domainSet || domainSet.has('note')) {
    for (const n of mockNotes) {
      if (matchesQuery(n.title || '', q) || matchesQuery(n.content, q)) {
        results.push({ domain: 'note', record_id: n.id, score: 0.85, snippet: getPreview(n.content, n.content_format), record: n as unknown as Record<string, unknown> });
      }
    }
  }

  // Events
  if (!domainSet || domainSet.has('event')) {
    for (const e of mockEvents) {
      if (matchesQuery(e.title, q) || matchesQuery(e.description || '', q) || matchesQuery(e.location || '', q)) {
        results.push({ domain: 'event', record_id: e.id, score: 0.78, snippet: `${e.location || 'No location'} · ${e.calendar_name}`, record: e as unknown as Record<string, unknown> });
      }
    }
  }

  // Contacts
  if (!domainSet || domainSet.has('contact')) {
    for (const c of mockContacts) {
      if (matchesQuery(c.display_name, q) || matchesQuery(c.company || '', q) || c.emails.some(e => matchesQuery(e.address, q))) {
        results.push({ domain: 'contact', record_id: c.id, score: 0.90, snippet: `${c.emails[0]?.address || ''} · ${c.job_title || ''}`, record: c as unknown as Record<string, unknown> });
      }
    }
  }

  // Diary
  if (!domainSet || domainSet.has('diary')) {
    for (const d of mockDiary) {
      if (matchesQuery(d.content, q) || d.tags.some(t => matchesQuery(t, q))) {
        results.push({ domain: 'diary', record_id: d.id, score: 0.65, snippet: getPreview(d.content, 'html'), record: d as unknown as Record<string, unknown> });
      }
    }
  }

  // Emails
  if (!domainSet || domainSet.has('email')) {
    for (const e of mockEmails) {
      if (matchesQuery(e.subject || '', q) || matchesQuery(e.from_name || '', q) || matchesQuery(e.body_plain || '', q)) {
        results.push({ domain: 'email', record_id: e.id, score: 0.82, snippet: `${e.from_name || e.from_address} — ${(e.body_plain || '').slice(0, 60)}`, record: e as unknown as Record<string, unknown> });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 12);
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

  // Agents (chat sidebar)
  if (method === 'GET' && route === '/agents') {
    return { data: MOCK_AGENTS };
  }

  // Conversations (chat)
  if (method === 'GET' && route === '/conversations' && !params.get('type')) {
    return { data: MOCK_CONVERSATIONS };
  }

  // ── Managed Agents (Agent Manager) ──

  if (method === 'GET' && route === '/managed-agents') {
    return { data: MOCK_MANAGED_AGENTS, meta: { total: MOCK_MANAGED_AGENTS.length, limit: 50, offset: 0 } };
  }

  const managedAgentGetMatch = route.match(/^\/managed-agents\/([\w-]+)$/);
  if (method === 'GET' && managedAgentGetMatch) {
    const agent = MOCK_MANAGED_AGENTS.find(a => a.id === managedAgentGetMatch[1]);
    return { data: agent || null };
  }

  if (method === 'POST' && route === '/managed-agents') {
    const input = body as Record<string, unknown>;
    const newAgent: ManagedAgent = {
      id: `agent-${++managedAgentIdCounter}`,
      name: (input.name as string) || 'new-agent',
      display_name: (input.display_name as string) || 'New Agent',
      role: (input.role as string) || 'Assistant',
      avatar: (input.avatar as string) || null,
      model: (input.model as string) || 'claude-sonnet-4-5',
      parent_agent_id: (input.parent_agent_id as string) || null,
      skills: (input.skills as ManagedAgent['skills']) || [],
      workspace_path: `/gateway/workspace/agents/${(input.name as string) || 'new-agent'}/`,
      status: 'idle',
      last_active_at: null,
      sessions_today: 0,
      tokens_today: 0,
      created_at: new Date().toISOString(),
    };
    MOCK_MANAGED_AGENTS.push(newAgent);
    return { data: newAgent };
  }

  // Agent conversations (inter-agent)
  if (method === 'GET' && route === '/agent-conversations') {
    let filtered = [...MOCK_AGENT_CONVERSATIONS];
    const agent = params.get('agent');
    if (agent) filtered = filtered.filter(c => c.from_agent === agent || c.to_agent === agent);
    return { data: filtered, meta: { total: filtered.length, limit: 100, offset: 0 } };
  }

  if (method === 'GET' && route === '/agent-conversations/stats') {
    return { data: MOCK_CONVERSATION_STATS };
  }

  // Agent identity files (SOUL.md, AGENT.md)
  const agentFileMatch = route.match(/^\/managed-agents\/([\w-]+)\/file$/);
  if (method === 'GET' && agentFileMatch) {
    const agent = MOCK_MANAGED_AGENTS.find(a => a.id === agentFileMatch[1]);
    const filename = params.get('name') || 'AGENT.md';
    const key = agent ? `${agent.name}/${filename}` : '';
    const content = MOCK_AGENT_FILES[key] || `# ${filename}\n\nNo content available.`;
    return { data: { content } };
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

  // ── Events CRUD ──

  if (method === 'GET' && route === '/events') {
    let filtered = mockEvents.filter(e => !e.deleted_at);
    const from = params.get('from');
    const to = params.get('to');
    if (from) filtered = filtered.filter(e => (e.end_at || e.start_at) >= from);
    if (to) filtered = filtered.filter(e => e.start_at <= to);
    const calName = params.get('calendar_name');
    if (calName) filtered = filtered.filter(e => e.calendar_name === calName);
    const search = params.get('search');
    if (search) filtered = filtered.filter(e => matchesQuery(e.title, search) || matchesQuery(e.description || '', search));
    // Date shorthand
    const dateParam = params.get('date');
    if (dateParam) {
      filtered = filtered.filter(e => e.start_at.startsWith(dateParam));
    }
    filtered.sort((a, b) => a.start_at.localeCompare(b.start_at));
    const limit = parseInt(params.get('limit') || '100');
    const offset = parseInt(params.get('offset') || '0');
    return { data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } };
  }

  const eventGetMatch = route.match(/^\/events\/([\w-]+)$/);
  if (method === 'GET' && eventGetMatch) {
    const evt = mockEvents.find(e => e.id === eventGetMatch[1]);
    return { data: evt || null };
  }

  if (method === 'POST' && route === '/events') {
    const input = body as Record<string, unknown>;
    const newEvt: CalendarEvent = {
      id: `evt-${++eventIdCounter}`,
      title: (input.title as string) || 'Untitled event',
      description: (input.description as string) || null,
      location: (input.location as string) || null,
      start_at: (input.start_at as string) || new Date().toISOString(),
      end_at: (input.end_at as string) || null,
      all_day: (input.all_day as boolean) || false,
      recurrence: null, status: 'confirmed',
      calendar_name: (input.calendar_name as string) || 'default',
      reminders: (input.reminders as CalendarEvent['reminders']) || [],
      attendees: (input.attendees as CalendarEvent['attendees']) || [],
      custom_fields: null, source: 'local', source_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      synced_at: null, deleted_at: null,
    };
    mockEvents.push(newEvt);
    return { data: newEvt };
  }

  const eventPatchMatch = route.match(/^\/events\/([\w-]+)$/);
  if (method === 'PATCH' && eventPatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockEvents.findIndex(e => e.id === eventPatchMatch[1]);
    if (idx !== -1) {
      mockEvents[idx] = { ...mockEvents[idx]!, ...input, updated_at: new Date().toISOString() } as CalendarEvent;
      return { data: mockEvents[idx] };
    }
    return { data: null };
  }

  const eventDeleteMatch = route.match(/^\/events\/([\w-]+)$/);
  if (method === 'DELETE' && eventDeleteMatch) {
    mockEvents = mockEvents.filter(e => e.id !== eventDeleteMatch[1]);
    return { data: { success: true } };
  }

  // ── Contacts CRUD ──

  if (method === 'GET' && route === '/contacts') {
    let filtered = mockContacts.filter(c => !c.deleted_at);
    const search = params.get('search');
    if (search) filtered = filtered.filter(c => matchesQuery(c.display_name, search) || matchesQuery(c.company || '', search));
    const tag = params.get('tag');
    if (tag) filtered = filtered.filter(c => c.tags.includes(tag));
    const sort = params.get('sort') || 'display_name';
    const order = params.get('order') || 'asc';
    filtered.sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[sort] ?? '');
      const bVal = String((b as unknown as Record<string, unknown>)[sort] ?? '');
      return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    });
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');
    return { data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } };
  }

  const contactGetMatch = route.match(/^\/contacts\/([\w-]+)$/);
  if (method === 'GET' && contactGetMatch) {
    const contact = mockContacts.find(c => c.id === contactGetMatch[1]);
    return { data: contact || null };
  }

  if (method === 'POST' && route === '/contacts') {
    const input = body as Record<string, unknown>;
    const newContact: Contact = {
      id: `contact-${++contactIdCounter}`,
      display_name: (input.display_name as string) || 'New Contact',
      first_name: (input.first_name as string) || null,
      last_name: (input.last_name as string) || null,
      emails: (input.emails as Contact['emails']) || [],
      phones: (input.phones as Contact['phones']) || [],
      company: (input.company as string) || null,
      job_title: (input.job_title as string) || null,
      addresses: [], notes: (input.notes as string) || null,
      avatar_path: null, tags: (input.tags as string[]) || [],
      custom_fields: null, source: 'local', source_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      synced_at: null, deleted_at: null,
    };
    mockContacts.push(newContact);
    return { data: newContact };
  }

  const contactPatchMatch = route.match(/^\/contacts\/([\w-]+)$/);
  if (method === 'PATCH' && contactPatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockContacts.findIndex(c => c.id === contactPatchMatch[1]);
    if (idx !== -1) {
      mockContacts[idx] = { ...mockContacts[idx]!, ...input, updated_at: new Date().toISOString() } as Contact;
      return { data: mockContacts[idx] };
    }
    return { data: null };
  }

  const contactDeleteMatch = route.match(/^\/contacts\/([\w-]+)$/);
  if (method === 'DELETE' && contactDeleteMatch) {
    mockContacts = mockContacts.filter(c => c.id !== contactDeleteMatch[1]);
    return { data: { success: true } };
  }

  // ── Diary CRUD ──

  if (method === 'GET' && route === '/diary') {
    let filtered = mockDiary.filter(d => !d.deleted_at);
    const search = params.get('search');
    if (search) filtered = filtered.filter(d => matchesQuery(d.content, search) || d.tags.some(t => matchesQuery(t, search)));
    const mood = params.get('mood');
    if (mood) filtered = filtered.filter(d => d.mood === mood);
    const from = params.get('from');
    const to = params.get('to');
    if (from) filtered = filtered.filter(d => d.entry_date >= from);
    if (to) filtered = filtered.filter(d => d.entry_date <= to);
    filtered.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    const limit = parseInt(params.get('limit') || '100');
    const offset = parseInt(params.get('offset') || '0');
    return { data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } };
  }

  const diaryDateMatch = route.match(/^\/diary\/date\/([\d-]+)$/);
  if (method === 'GET' && diaryDateMatch) {
    const entry = mockDiary.find(d => d.entry_date === diaryDateMatch[1]);
    if (entry) return { data: entry };
    return { error: { code: 'NOT_FOUND', message: 'No entry for this date' }, status: 404 };
  }

  const diaryGetMatch = route.match(/^\/diary\/([\w-]+)$/);
  if (method === 'GET' && diaryGetMatch) {
    const entry = mockDiary.find(d => d.id === diaryGetMatch[1]);
    return { data: entry || null };
  }

  if (method === 'POST' && route === '/diary') {
    const input = body as Record<string, unknown>;
    const newEntry: DiaryEntry = {
      id: `diary-${++diaryIdCounter}`,
      entry_date: (input.entry_date as string) || new Date().toISOString().slice(0, 10),
      content: (input.content as string) || '',
      mood: (input.mood as DiaryEntry['mood']) || null,
      tags: (input.tags as string[]) || [],
      weather: null, custom_fields: null,
      is_encrypted: false, is_draft: false, source: 'local',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      synced_at: null, deleted_at: null,
    };
    mockDiary.unshift(newEntry);
    return { data: newEntry };
  }

  const diaryPatchMatch = route.match(/^\/diary\/([\w-]+)$/);
  if (method === 'PATCH' && diaryPatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockDiary.findIndex(d => d.id === diaryPatchMatch[1]);
    if (idx !== -1) {
      mockDiary[idx] = { ...mockDiary[idx]!, ...input, updated_at: new Date().toISOString() } as DiaryEntry;
      return { data: mockDiary[idx] };
    }
    return { data: null };
  }

  const diaryDeleteMatch = route.match(/^\/diary\/([\w-]+)$/);
  if (method === 'DELETE' && diaryDeleteMatch) {
    mockDiary = mockDiary.filter(d => d.id !== diaryDeleteMatch[1]);
    return { data: { success: true } };
  }

  // ── Email Accounts ──

  if (method === 'GET' && route === '/email-accounts') {
    return { data: MOCK_EMAIL_ACCOUNTS, meta: { total: MOCK_EMAIL_ACCOUNTS.length, limit: 20, offset: 0 } };
  }

  // ── Emails CRUD ──

  if (method === 'GET' && route === '/emails') {
    let filtered = mockEmails.filter(e => !e.deleted_at);
    const folder = params.get('folder');
    if (folder) filtered = filtered.filter(e => e.folder === folder);
    const accountId = params.get('account_id');
    if (accountId) filtered = filtered.filter(e => e.account_id === accountId);
    const search = params.get('search');
    if (search) filtered = filtered.filter(e =>
      matchesQuery(e.subject || '', search) || matchesQuery(e.from_name || '', search) || matchesQuery(e.body_plain || '', search));
    const isRead = params.get('is_read');
    if (isRead === 'true') filtered = filtered.filter(e => e.is_read);
    if (isRead === 'false') filtered = filtered.filter(e => !e.is_read);
    const isStarred = params.get('is_starred');
    if (isStarred === 'true') filtered = filtered.filter(e => e.is_starred);
    const hasAttachments = params.get('has_attachments');
    if (hasAttachments === 'true') filtered = filtered.filter(e => e.has_attachments);
    const label = params.get('label');
    if (label) filtered = filtered.filter(e => e.labels.includes(label));
    const threadId = params.get('thread_id');
    if (threadId) filtered = filtered.filter(e => e.thread_id === threadId);
    const sort = params.get('sort') || 'received_at';
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

  const emailGetMatch = route.match(/^\/emails\/([\w-]+)$/);
  if (method === 'GET' && emailGetMatch) {
    const email = mockEmails.find(e => e.id === emailGetMatch[1]);
    return { data: email || null };
  }

  if (method === 'POST' && route === '/emails/send') {
    const input = body as Record<string, unknown>;
    const newEmail: Email = {
      id: `email-${++emailIdCounter}`,
      message_id: `<msg-${emailIdCounter}@clearmud.ai>`,
      thread_id: null,
      subject: (input.subject as string) || null,
      from_address: MOCK_EMAIL_ACCOUNTS.find(a => a.id === (input.account_id as string))?.email_address || 'paco@clearmud.ai',
      from_name: 'Paco García',
      to_addresses: (input.to_addresses as Email['to_addresses']) || [],
      cc_addresses: (input.cc_addresses as Email['cc_addresses']) || [],
      bcc_addresses: (input.bcc_addresses as Email['bcc_addresses']) || [],
      body_plain: (input.body_plain as string) || null,
      body_html: (input.body_html as string) || null,
      has_attachments: false, attachments: [],
      folder: 'SENT', is_read: true, is_starred: false, custom_fields: null,
      received_at: new Date().toISOString(), source: 'local', source_id: null,
      account_id: (input.account_id as string) || 'acc-1',
      status: 'sent', in_reply_to: (input.in_reply_to as string) || null, references: [],
      labels: [], snoozed_until: null, pre_snooze_folder: null,
      scheduled_at: null, send_attempts: 1, next_retry_at: null, send_error: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      synced_at: null, deleted_at: null,
    };
    mockEmails.unshift(newEmail);
    return { data: newEmail };
  }

  if (method === 'POST' && route === '/emails/batch') {
    return { data: { success: true } };
  }

  const emailActionMatch = route.match(/^\/emails\/([\w-]+)\/(read|unread|star|unstar|snooze|unsnooze|restore)$/);
  if (method === 'POST' && emailActionMatch) {
    const [, id, action] = emailActionMatch;
    const idx = mockEmails.findIndex(e => e.id === id);
    if (idx !== -1) {
      if (action === 'read') mockEmails[idx] = { ...mockEmails[idx]!, is_read: true };
      if (action === 'unread') mockEmails[idx] = { ...mockEmails[idx]!, is_read: false };
      if (action === 'star') mockEmails[idx] = { ...mockEmails[idx]!, is_starred: true };
      if (action === 'unstar') mockEmails[idx] = { ...mockEmails[idx]!, is_starred: false };
      if (action === 'snooze') {
        const input = body as Record<string, unknown>;
        mockEmails[idx] = { ...mockEmails[idx]!, snoozed_until: (input.until as string), pre_snooze_folder: mockEmails[idx]!.folder, folder: 'SNOOZED' };
      }
      if (action === 'unsnooze') {
        mockEmails[idx] = { ...mockEmails[idx]!, snoozed_until: null, folder: mockEmails[idx]!.pre_snooze_folder || 'INBOX', pre_snooze_folder: null };
      }
    }
    return { data: { success: true } };
  }

  const emailPatchMatch = route.match(/^\/emails\/([\w-]+)$/);
  if (method === 'PATCH' && emailPatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockEmails.findIndex(e => e.id === emailPatchMatch[1]);
    if (idx !== -1) {
      mockEmails[idx] = { ...mockEmails[idx]!, ...input, updated_at: new Date().toISOString() } as Email;
      return { data: mockEmails[idx] };
    }
    return { data: null };
  }

  const emailDeleteMatch = route.match(/^\/emails\/([\w-]+)$/);
  if (method === 'DELETE' && emailDeleteMatch) {
    mockEmails = mockEmails.filter(e => e.id !== emailDeleteMatch[1]);
    return { data: { success: true } };
  }

  // ── Files / Drive ──

  if (method === 'GET' && route === '/files') {
    const parentFolder = params.get('parent_folder');
    const isDir = params.get('is_directory');
    const mimeType = params.get('mime_type');
    const searchQ = params.get('search')?.toLowerCase();
    let filtered = [...mockFiles];
    if (parentFolder) filtered = filtered.filter(f => f.parent_folder === parentFolder);
    if (isDir === 'true') filtered = filtered.filter(f => f.is_directory);
    if (isDir === 'false') filtered = filtered.filter(f => !f.is_directory);
    if (mimeType) filtered = filtered.filter(f => f.mime_type.startsWith(mimeType));
    if (searchQ) filtered = filtered.filter(f => f.filename.toLowerCase().includes(searchQ));
    // Sort: dirs first, then alphabetical
    filtered.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.filename.localeCompare(b.filename);
    });
    return { data: filtered, meta: { total: filtered.length, limit: 100, offset: 0 } };
  }

  if (method === 'POST' && route === '/files/upload') {
    const input = body as Record<string, unknown>;
    const parentFolder = (input.parent_folder as string) || '/drive/';
    const filename = (input.file as { name?: string })?.name || `upload-${Date.now()}.bin`;
    const newFile: FileRecord = {
      id: `file-${++fileIdCounter}`,
      filename,
      filepath: `${parentFolder}${filename}`,
      mime_type: 'application/octet-stream',
      size_bytes: 1024,
      checksum_sha256: null,
      source: 'local',
      source_id: null,
      parent_folder: parentFolder,
      is_directory: false,
      metadata: null,
      tags: [],
      custom_fields: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      deleted_at: null,
    };
    mockFiles.push(newFile);
    return { data: newFile };
  }

  if (method === 'POST' && route === '/files/mkdir') {
    const input = body as Record<string, unknown>;
    const name = (input.name as string) || 'New Folder';
    const parentFolder = (input.parent_folder as string) || '/drive/';
    const newDir: FileRecord = {
      id: `file-${++fileIdCounter}`,
      filename: name,
      filepath: `${parentFolder}${name}/`,
      mime_type: 'inode/directory',
      size_bytes: 0,
      checksum_sha256: null,
      source: 'local',
      source_id: null,
      parent_folder: parentFolder,
      is_directory: true,
      metadata: null,
      tags: [],
      custom_fields: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      deleted_at: null,
    };
    mockFiles.push(newDir);
    return { data: newDir };
  }

  const filePatchMatch = route.match(/^\/files\/([\w-]+)$/);
  if (method === 'PATCH' && filePatchMatch) {
    const input = body as Record<string, unknown>;
    const idx = mockFiles.findIndex(f => f.id === filePatchMatch[1]);
    if (idx !== -1) {
      mockFiles[idx] = { ...mockFiles[idx]!, ...input, updated_at: new Date().toISOString() } as FileRecord;
      return { data: mockFiles[idx] };
    }
    return { data: null };
  }

  const fileDeleteMatch = route.match(/^\/files\/([\w-]+)$/);
  if (method === 'DELETE' && fileDeleteMatch) {
    mockFiles = mockFiles.filter(f => f.id !== fileDeleteMatch[1]);
    return { data: { success: true } };
  }

  // Share a file
  const fileShareMatch = route.match(/^\/files\/([\w-]+)\/share$/);
  if (method === 'POST' && fileShareMatch) {
    const fileId = fileShareMatch[1];
    const url = `https://claw.os/s/${fileId?.slice(0, 8)}-${Date.now().toString(36)}`;
    return { data: { url } };
  }

  // ── Photos / Timeline ──

  if (method === 'GET' && route === '/photos/timeline') {
    const lim = parseInt(params.get('limit') || '50');
    const off = parseInt(params.get('offset') || '0');
    const sorted = [...MOCK_PHOTOS].sort((a, b) => new Date(b.taken_at || b.created_at).getTime() - new Date(a.taken_at || a.created_at).getTime());
    const sliced = sorted.slice(off, off + lim);
    return { data: sliced, meta: { total: sorted.length, limit: lim, offset: off } };
  }

  // ── Albums ──

  if (method === 'GET' && route === '/albums') {
    return { data: [...mockAlbums], meta: { total: mockAlbums.length, limit: 100, offset: 0 } };
  }

  if (method === 'POST' && route === '/albums') {
    const input = body as Record<string, unknown>;
    const newAlbum: Album = {
      id: `album-${++albumIdCounter}`,
      name: (input.name as string) || 'Untitled',
      description: null,
      cover_photo_id: null,
      cover_mode: 'first',
      album_type: (input.album_type as Album['album_type']) || 'manual',
      filters: null,
      photo_count: 0,
      custom_fields: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockAlbums.unshift(newAlbum);
    return { data: newAlbum };
  }

  const albumDeleteMatch = route.match(/^\/albums\/([\w-]+)$/);
  if (method === 'DELETE' && albumDeleteMatch) {
    mockAlbums = mockAlbums.filter(a => a.id !== albumDeleteMatch[1]);
    return { data: { success: true } };
  }

  // ── Entity Links ──

  if (method === 'GET' && route === '/links') {
    const entityId = params.get('entity_id');
    if (entityId) {
      const allLinks = [...MOCK_LINKS, ...MOCK_EMAIL_LINKS];
      const links = allLinks.filter(l => l.source_id === entityId || l.target_id === entityId);
      return { data: links, meta: { total: links.length, limit: 20, offset: 0 } };
    }
    return { data: [], meta: { total: 0, limit: 20, offset: 0 } };
  }

  // Linked record enrichment — try real mock data first, fallback to static records
  const enrichMatch = route.match(/^\/(emails|events|contacts|files|diary)\/([\w-]+)$/);
  if (method === 'GET' && enrichMatch) {
    const [, domain, id] = enrichMatch;
    if (domain === 'events') {
      const evt = mockEvents.find(e => e.id === id);
      if (evt) return { data: evt };
    }
    if (domain === 'contacts') {
      const c = mockContacts.find(ct => ct.id === id);
      if (c) return { data: c };
    }
    if (domain === 'diary') {
      const d = mockDiary.find(di => di.id === id);
      if (d) return { data: d };
    }
    if (domain === 'files') {
      const f = mockFiles.find(fi => fi.id === id);
      if (f) return { data: f };
    }
    const record = MOCK_LINKED_RECORDS[id!];
    return { data: record || { id } };
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

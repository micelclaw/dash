import type { MockRoute } from '../api-spy';

const CONTACT_1 = {
  id: 'contact-001',
  first_name: 'Alice',
  last_name: 'Smith',
  display_name: 'Alice Smith',
  company: 'TestCorp',
  job_title: 'Engineer',
  emails: [{ address: 'alice@test.com', label: 'work', primary: true }],
  phones: [{ number: '+1 555 0001', label: 'work', primary: true }],
  tags: ['test', 'e2e'],
  notes: '',
  source: 'manual',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

const CONTACT_2 = {
  id: 'contact-002',
  first_name: 'Bob',
  last_name: 'Jones',
  display_name: 'Bob Jones',
  company: 'DevInc',
  job_title: 'Designer',
  emails: [{ address: 'bob@dev.com', label: 'personal', primary: true }],
  phones: [],
  tags: ['test'],
  notes: '',
  source: 'manual',
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

export const CONTACTS_LIST = [CONTACT_1, CONTACT_2];

export const contactsMocks: MockRoute[] = [
  // List contacts
  {
    method: 'GET',
    path: '/contacts',
    response: { data: CONTACTS_LIST, meta: { total: 2, limit: 100, offset: 0 } },
  },
  // Get single contact
  {
    method: 'GET',
    path: '/contacts/*',
    response: { data: CONTACT_1 },
  },
  // Create contact
  {
    method: 'POST',
    path: '/contacts',
    response: {
      data: {
        id: 'contact-new',
        first_name: 'New',
        last_name: 'Contact',
        display_name: 'New Contact',
        company: '',
        job_title: '',
        emails: [],
        phones: [],
        tags: [],
        notes: '',
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Update contact
  {
    method: 'PATCH',
    path: '/contacts/*',
    response: { data: { ...CONTACT_1, updated_at: new Date().toISOString() } },
  },
  // Delete contact
  {
    method: 'DELETE',
    path: '/contacts/*',
    response: { data: { id: CONTACT_1.id, deleted: true } },
  },
  // Restore contact
  {
    method: 'POST',
    path: '/contacts/*/restore',
    response: { data: CONTACT_1 },
  },
];

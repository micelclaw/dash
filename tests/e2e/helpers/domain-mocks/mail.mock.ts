import type { MockRoute } from '../api-spy';

const EMAIL_1 = {
  id: 'email-1',
  subject: 'Welcome',
  from_address: 'bob@example.com',
  from_name: 'Bob',
  to_addresses: ['paco@local'],
  folder: 'INBOX',
  is_read: false,
  is_starred: false,
  body_plain: 'Hello there',
  created_at: '2026-03-26T08:00:00Z',
  status: 'received',
};

const EMAIL_2 = {
  id: 'email-2',
  subject: 'Meeting Notes',
  from_address: 'alice@example.com',
  from_name: 'Alice',
  to_addresses: ['paco@local'],
  folder: 'INBOX',
  is_read: true,
  is_starred: false,
  body_plain: 'Here are the notes',
  created_at: '2026-03-25T15:00:00Z',
  status: 'received',
};

export const EMAILS_LIST = [EMAIL_1, EMAIL_2];

const ACCOUNT_1 = {
  id: 'acc-1',
  email_address: 'paco@local',
  display_name: 'Paco',
  color: '#3b82f6',
};

export const mailMocks: MockRoute[] = [
  // List emails
  {
    method: 'GET',
    path: '/emails',
    response: { data: EMAILS_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get single email
  {
    method: 'GET',
    path: '/emails/*',
    response: { data: EMAIL_1 },
  },
  // List email accounts
  {
    method: 'GET',
    path: '/email-accounts',
    response: { data: [ACCOUNT_1], meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Create draft
  {
    method: 'POST',
    path: '/emails/drafts',
    response: {
      data: {
        id: 'draft-1',
        subject: '',
        from_address: 'paco@local',
        from_name: 'Paco',
        to_addresses: [],
        folder: 'DRAFTS',
        is_read: true,
        is_starred: false,
        body_plain: '',
        created_at: new Date().toISOString(),
        status: 'draft',
      },
    },
  },
  // Send email
  {
    method: 'POST',
    path: '/emails/send',
    response: {
      data: {
        id: 'sent-1',
        subject: 'Test Subject',
        from_address: 'paco@local',
        from_name: 'Paco',
        to_addresses: ['recipient@example.com'],
        folder: 'SENT',
        is_read: true,
        is_starred: false,
        body_plain: 'Test body',
        created_at: new Date().toISOString(),
        status: 'sent',
      },
    },
  },
  // Batch operations
  {
    method: 'POST',
    path: '/emails/batch',
    response: { data: { processed: 2 } },
  },
  // Block sender
  {
    method: 'POST',
    path: '/emails/block-sender',
    status: 204,
    response: {},
  },
  // Mark as read
  {
    method: 'POST',
    path: '/emails/**/read',
    status: 204,
    response: {},
  },
  // Mark as unread
  {
    method: 'POST',
    path: '/emails/**/unread',
    status: 204,
    response: {},
  },
  // Report spam
  {
    method: 'POST',
    path: '/emails/**/report-spam',
    status: 204,
    response: {},
  },
  // Snooze
  {
    method: 'POST',
    path: '/emails/**/snooze',
    status: 204,
    response: {},
  },
  // Unsnooze
  {
    method: 'POST',
    path: '/emails/**/unsnooze',
    status: 204,
    response: {},
  },
  // Restore
  {
    method: 'POST',
    path: '/emails/**/restore',
    response: { data: { ...EMAIL_1, folder: 'INBOX' } },
  },
  // Update email
  {
    method: 'PATCH',
    path: '/emails/*',
    response: { data: { ...EMAIL_1, updated_at: new Date().toISOString() } },
  },
  // Delete email
  {
    method: 'DELETE',
    path: '/emails/*',
    status: 204,
    response: {},
  },
  // Create email account
  {
    method: 'POST',
    path: '/email-accounts',
    response: {
      data: {
        id: 'acc-new',
        email_address: 'new@local',
        display_name: 'New Account',
        color: '#10b981',
      },
    },
  },
  // Update email account
  {
    method: 'PATCH',
    path: '/email-accounts/*',
    response: { data: { ...ACCOUNT_1, updated_at: new Date().toISOString() } },
  },
  // Delete email account
  {
    method: 'DELETE',
    path: '/email-accounts/*',
    status: 204,
    response: {},
  },
  // Contacts (for compose autocomplete)
  {
    method: 'GET',
    path: '/contacts',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Sync connectors
  {
    method: 'GET',
    path: '/sync/connectors',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
];

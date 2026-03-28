import type { MockRoute } from '../api-spy';

const CONVERSATION_1 = {
  id: 'conv-1',
  title: 'Help with code',
  created_at: '2026-03-26T10:00:00Z',
  message_count: 5,
};

const CONVERSATION_1_DETAIL = {
  ...CONVERSATION_1,
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      created_at: '2026-03-26T10:00:00Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hi! How can I help?',
      created_at: '2026-03-26T10:00:01Z',
    },
  ],
};

export const CONVERSATIONS_LIST = [CONVERSATION_1];

export const chatMocks: MockRoute[] = [
  // List conversations
  {
    method: 'GET',
    path: '/conversations',
    response: { data: CONVERSATIONS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single conversation with messages
  {
    method: 'GET',
    path: '/conversations/*',
    response: { data: CONVERSATION_1_DETAIL },
  },
  // Delete conversation thread
  {
    method: 'DELETE',
    path: '/conversations/threads/*',
    status: 204,
    response: null,
  },
  // Create bookmark
  {
    method: 'POST',
    path: '/bookmarks',
    response: {
      data: {
        id: 'bm-new',
        conversation_id: CONVERSATION_1.id,
        message_id: 'msg-2',
        created_at: new Date().toISOString(),
      },
    },
  },
  // Save canvas
  {
    method: 'POST',
    path: '/canvas/save',
    response: { data: { id: 'canvas-1', saved: true } },
  },
];

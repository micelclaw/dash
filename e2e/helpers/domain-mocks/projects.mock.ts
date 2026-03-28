import type { MockRoute } from '../api-spy';

const CARD_1 = {
  id: 'card-1',
  title: 'Fix bug',
  column_id: 'col-1',
  position: 0,
  priority: 'high',
};

const COLUMN_1 = {
  id: 'col-1',
  title: 'To Do',
  position: 0,
  cards: [CARD_1],
};

const COLUMN_2 = {
  id: 'col-2',
  title: 'Done',
  position: 1,
  cards: [],
};

const LABEL_1 = {
  id: 'lbl-1',
  name: 'Bug',
  color: '#ef4444',
};

const BOARD_1 = {
  id: 'board-1',
  title: 'Sprint Board',
  description: 'Current sprint',
  color: '#3b82f6',
  archived: false,
  columns: [COLUMN_1, COLUMN_2],
  labels: [LABEL_1],
};

export const BOARDS_LIST = [BOARD_1];

export const projectsMocks: MockRoute[] = [
  // List boards
  {
    method: 'GET',
    path: '/projects/boards',
    response: { data: BOARDS_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single board
  {
    method: 'GET',
    path: '/projects/boards/*',
    response: { data: BOARD_1 },
  },
  // Create board
  {
    method: 'POST',
    path: '/projects/boards',
    response: {
      data: {
        id: 'board-new',
        title: '',
        description: '',
        color: '#3b82f6',
        archived: false,
        columns: [],
        labels: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Update board
  {
    method: 'PATCH',
    path: '/projects/boards/*',
    response: { data: { ...BOARD_1, updated_at: new Date().toISOString() } },
  },
  // Delete board
  {
    method: 'DELETE',
    path: '/projects/boards/*',
    status: 204,
    response: {},
  },
  // Archive board
  {
    method: 'POST',
    path: '/projects/boards/**/archive',
    status: 204,
    response: {},
  },
  // Unarchive board
  {
    method: 'POST',
    path: '/projects/boards/**/unarchive',
    status: 204,
    response: {},
  },
  // Create column
  {
    method: 'POST',
    path: '/projects/boards/**/columns',
    response: {
      data: {
        id: 'col-new',
        title: '',
        position: 0,
        cards: [],
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update column
  {
    method: 'PATCH',
    path: '/projects/boards/**/columns/*',
    response: { data: { ...COLUMN_1, updated_at: new Date().toISOString() } },
  },
  // Delete column
  {
    method: 'DELETE',
    path: '/projects/boards/**/columns/*',
    status: 204,
    response: {},
  },
  // Create card
  {
    method: 'POST',
    path: '/projects/boards/**/cards',
    response: {
      data: {
        id: 'card-new',
        title: '',
        column_id: 'col-1',
        position: 0,
        priority: 'medium',
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update card
  {
    method: 'PATCH',
    path: '/projects/boards/**/cards/*',
    response: { data: { ...CARD_1, updated_at: new Date().toISOString() } },
  },
  // Delete card
  {
    method: 'DELETE',
    path: '/projects/boards/**/cards/*',
    status: 204,
    response: {},
  },
  // Move card
  {
    method: 'PATCH',
    path: '/projects/boards/**/cards/**/move',
    response: { data: { ...CARD_1, column_id: 'col-2', position: 0 } },
  },
  // Bulk cards
  {
    method: 'POST',
    path: '/projects/boards/**/cards/bulk',
    response: { data: { processed: 1 } },
  },
  // Create label
  {
    method: 'POST',
    path: '/projects/boards/**/labels',
    response: {
      data: {
        id: 'lbl-new',
        name: '',
        color: '#6b7280',
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update label
  {
    method: 'PATCH',
    path: '/projects/boards/**/labels/*',
    response: { data: { ...LABEL_1, updated_at: new Date().toISOString() } },
  },
  // Delete label
  {
    method: 'DELETE',
    path: '/projects/boards/**/labels/*',
    status: 204,
    response: {},
  },
  // Add label to card
  {
    method: 'POST',
    path: '/projects/boards/**/cards/**/labels/*',
    status: 204,
    response: {},
  },
  // Remove label from card
  {
    method: 'DELETE',
    path: '/projects/boards/**/cards/**/labels/*',
    status: 204,
    response: {},
  },
  // Delete card link
  {
    method: 'DELETE',
    path: '/projects/boards/**/cards/**/links/*',
    status: 204,
    response: {},
  },
  // Delete custom field
  {
    method: 'DELETE',
    path: '/projects/boards/**/custom-fields/*',
    status: 204,
    response: {},
  },
  // Create automation
  {
    method: 'POST',
    path: '/projects/boards/**/automations',
    response: {
      data: {
        id: 'auto-new',
        name: '',
        enabled: true,
        created_at: new Date().toISOString(),
      },
    },
  },
  // Update automation
  {
    method: 'PATCH',
    path: '/projects/boards/**/automations/*',
    response: {
      data: {
        id: 'auto-1',
        name: 'Updated',
        enabled: true,
        updated_at: new Date().toISOString(),
      },
    },
  },
  // Delete automation
  {
    method: 'DELETE',
    path: '/projects/boards/**/automations/*',
    status: 204,
    response: {},
  },
  // List automations
  {
    method: 'GET',
    path: '/projects/boards/**/automations',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
];

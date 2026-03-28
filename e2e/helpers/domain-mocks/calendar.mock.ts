import type { MockRoute } from '../api-spy';

const CALENDAR_1 = {
  id: 'cal-1',
  name: 'Personal',
  color: '#22c55e',
  source: 'local',
  visible: true,
};

const CALENDAR_2 = {
  id: 'cal-2',
  name: 'Work',
  color: '#d4a017',
  source: 'local',
  visible: true,
};

const EVENT_1 = {
  id: 'evt-1',
  title: 'Team Meeting',
  start_at: '2026-03-26T10:00:00Z',
  end_at: '2026-03-26T11:00:00Z',
  all_day: false,
  calendar_name: 'Work',
  status: 'confirmed',
  location: 'Conference Room',
};

const EVENT_2 = {
  id: 'evt-2',
  title: 'Lunch',
  start_at: '2026-03-26T12:00:00Z',
  end_at: '2026-03-26T13:00:00Z',
  all_day: false,
  calendar_name: 'Personal',
  status: 'confirmed',
};

export const CALENDARS_LIST = [CALENDAR_1, CALENDAR_2];
export const EVENTS_LIST = [EVENT_1, EVENT_2];

export const calendarMocks: MockRoute[] = [
  // List calendars
  {
    method: 'GET',
    path: '/calendars',
    response: { data: CALENDARS_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // List events
  {
    method: 'GET',
    path: '/events',
    response: { data: EVENTS_LIST, meta: { total: 2, limit: 50, offset: 0 } },
  },
  // Get single event
  {
    method: 'GET',
    path: '/events/*',
    response: { data: EVENT_1 },
  },
  // Create calendar
  {
    method: 'POST',
    path: '/calendars',
    response: {
      data: {
        id: 'cal-new',
        name: '',
        color: '#3b82f6',
        source: 'local',
        visible: true,
      },
    },
  },
  // Create event
  {
    method: 'POST',
    path: '/events',
    response: {
      data: {
        id: 'evt-new',
        title: '',
        start_at: new Date().toISOString(),
        end_at: new Date().toISOString(),
        all_day: false,
        calendar_name: 'Personal',
        status: 'confirmed',
      },
    },
  },
  // Update event
  {
    method: 'PATCH',
    path: '/events/*',
    response: { data: { ...EVENT_1, updated_at: new Date().toISOString() } },
  },
  // Delete event
  {
    method: 'DELETE',
    path: '/events/*',
    status: 204,
    response: {},
  },
  // Delete calendar
  {
    method: 'DELETE',
    path: '/calendars/*',
    status: 204,
    response: {},
  },
  // Restore event
  {
    method: 'POST',
    path: '/events/**/restore',
    response: { data: { ...EVENT_1, deleted_at: null } },
  },
  // Sync connectors (empty)
  {
    method: 'GET',
    path: '/sync/connectors',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
  // Project boards for virtual calendars (empty)
  {
    method: 'GET',
    path: '/projects/boards',
    response: { data: [], meta: { total: 0, limit: 50, offset: 0 } },
  },
];

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  recurrence: { freq: string; byday?: string[]; until?: string } | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  calendar_name: string;
  reminders: { type: string; minutes_before: number }[];
  attendees: { email: string; name?: string; status: string }[];
  custom_fields: Record<string, unknown> | null;
  source: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface EventCreateInput {
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at?: string;
  all_day?: boolean;
  calendar_name?: string;
  reminders?: { type: string; minutes_before: number }[];
  attendees?: { email: string; name?: string; status?: string }[];
}

export interface EventUpdateInput {
  title?: string;
  description?: string;
  location?: string;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  status?: string;
  calendar_name?: string;
  reminders?: { type: string; minutes_before: number }[];
  attendees?: { email: string; name?: string; status?: string }[];
}

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

export interface CalendarConfig {
  name: string;
  color: string;
  visible: boolean;
}

export const DEFAULT_CALENDAR_COLORS: Record<string, string> = {
  default: '#3b82f6',
  Personal: '#22c55e',
  Work: '#d4a017',
  Shared: '#a855f7',
};

export function getCalendarColor(name: string | null | undefined): string {
  if (!name) return DEFAULT_CALENDAR_COLORS['default'];
  return DEFAULT_CALENDAR_COLORS[name] || hashToColor(name);
}

function hashToColor(str: string): string {
  let hash = 0;
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 50%, 50%)`;
}

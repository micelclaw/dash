/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import type { CSSProperties } from 'react';
import type { CalendarEvent, EventCreateInput } from '../types';

/** Estado agrupado del formulario del EventModal (un solo useState en vez de 9) */
export interface EventFormState {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  calendarName: string;
  description: string;
  attendeesStr: string;
  tags: string[];
  /** Reminder offsets (minutes before start). Delivered by the calendar-reminders job. */
  reminders: { type: string; minutes_before: number }[];
}

export function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Form state pre-filled from an existing event (view/edit mode) */
export function eventToFormState(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    startAt: toLocalDatetime(event.start_at),
    endAt: event.end_at ? toLocalDatetime(event.end_at) : '',
    allDay: event.all_day,
    location: event.location || '',
    calendarName: event.calendar_name,
    description: event.description || '',
    attendeesStr: event.attendees?.map((a) => a.email).join(', ') ?? '',
    tags: event.tags ?? [],
    reminders: event.reminders ?? [],
  };
}

/** Empty form with sensible defaults (create mode) */
export function createFormState(defaultDate?: Date | null): EventFormState {
  const now = defaultDate ? new Date(defaultDate) : new Date();
  if (!defaultDate) {
    const minutes = Math.ceil(now.getMinutes() / 30) * 30;
    now.setMinutes(minutes, 0, 0);
  }
  const endDefault = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    title: '',
    startAt: toLocalDatetime(now.toISOString()),
    endAt: toLocalDatetime(endDefault.toISOString()),
    allDay: false,
    location: '',
    calendarName: 'Personal',
    description: '',
    attendeesStr: '',
    tags: [],
    reminders: [],
  };
}

/** Payload for POST/PATCH (shape is valid both as EventCreateInput and EventUpdateInput) */
export function formStateToInput(form: EventFormState): EventCreateInput {
  return {
    title: form.title || 'Untitled event',
    start_at: new Date(form.startAt).toISOString(),
    end_at: form.endAt ? new Date(form.endAt).toISOString() : undefined,
    all_day: form.allDay,
    location: form.location || undefined,
    calendar_name: form.calendarName,
    description: form.description || undefined,
    attendees: form.attendeesStr
      ? form.attendeesStr.split(',').map((e) => ({ email: e.trim() }))
      : [],
    tags: form.tags,
    reminders: form.reminders,
  };
}

export const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

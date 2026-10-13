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

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from '@/components/shared/TagInput';
import { DEFAULT_CALENDAR_COLORS } from '../types';
import { AttendeesField } from './AttendeesField';
import { fieldLabelStyle, type EventFormState } from './event-form';

type Reminder = { type: string; minutes_before: number };
const REMINDER_PRESETS = [0, 15, 30, 60, 120, 1440];

function reminderLabel(m: number): string {
  if (m <= 0) return 'At start';
  if (m % 1440 === 0) { const d = m / 1440; return `${d} day${d > 1 ? 's' : ''} before`; }
  if (m % 60 === 0) { const h = m / 60; return `${h} hour${h > 1 ? 's' : ''} before`; }
  return `${m} min before`;
}

interface EventFormFieldsProps {
  form: EventFormState;
  onChange: (patch: Partial<EventFormState>) => void;
  /** Calendarios reales del usuario; sin ellos el select cae a los defaults. */
  calendarNames?: string[];
}

/** Campos del formulario de creación/edición de evento (modo edit/create del EventModal) */
export function EventFormFields({ form, onChange, calendarNames }: EventFormFieldsProps) {
  // Los calendarios REALES del usuario mandan; los defaults hardcodeados solo son el
  // fallback sin datos (antes era imposible crear un evento en un calendario propio).
  const calendarOptions = calendarNames?.length
    ? calendarNames
    : Object.keys(DEFAULT_CALENDAR_COLORS).filter((k) => k !== 'default');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Title */}
      <div>
        <label style={fieldLabelStyle}>Title</label>
        <Input
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Event title"
        />
      </div>

      {/* Date inputs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={fieldLabelStyle}>Start</label>
          <Input
            type={form.allDay ? 'date' : 'datetime-local'}
            value={form.allDay ? form.startAt.slice(0, 10) : form.startAt}
            onChange={(e) => onChange({ startAt: e.target.value })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={fieldLabelStyle}>End</label>
          <Input
            type={form.allDay ? 'date' : 'datetime-local'}
            value={form.allDay ? form.endAt.slice(0, 10) : form.endAt}
            onChange={(e) => onChange({ endAt: e.target.value })}
          />
        </div>
      </div>

      {/* All-day toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.8125rem',
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <Checkbox
          checked={form.allDay}
          onCheckedChange={(checked) => onChange({ allDay: checked === true })}
        />
        All day
      </label>

      {/* Location */}
      <div>
        <label style={fieldLabelStyle}>Location</label>
        <Input
          value={form.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Add location"
        />
      </div>

      {/* Calendar dropdown */}
      <div>
        <label style={fieldLabelStyle}>Calendar</label>
        <Select value={form.calendarName} onValueChange={(v) => onChange({ calendarName: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Calendar" />
          </SelectTrigger>
          <SelectContent>
            {calendarOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
            {!calendarOptions.includes(form.calendarName) && form.calendarName && (
              <SelectItem value={form.calendarName}>{form.calendarName}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Reminders */}
      <div>
        <label style={{ ...fieldLabelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bell size={13} /> Reminders
        </label>
        <ReminderField value={form.reminders} onChange={(reminders) => onChange({ reminders })} />
      </div>

      {/* Description */}
      <div>
        <label style={fieldLabelStyle}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          placeholder="Add description"
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: 60,
          }}
        />
      </div>

      {/* Attendees */}
      <AttendeesField value={form.attendeesStr} onChange={(v) => onChange({ attendeesStr: v })} />

      {/* Tags */}
      <div>
        <label style={fieldLabelStyle}>Tags</label>
        <div>
          <TagInput tags={form.tags} onChange={(tags) => onChange({ tags })} />
        </div>
      </div>
    </div>
  );
}

/**
 * Reminder offsets editor: preset toggle chips (At start / 15m / 30m / 1h / 2h /
 * 1 day) + a custom adder (number × min/hours/days). Selected custom values that
 * aren't presets show as removable chips. Emits `{ type: 'notification',
 * minutes_before }[]` — delivered by the calendar-reminders job.
 */
function ReminderField({ value, onChange }: { value: Reminder[]; onChange: (r: Reminder[]) => void }) {
  const [customVal, setCustomVal] = useState('10');
  const [customUnit, setCustomUnit] = useState<'min' | 'hours' | 'days'>('min');

  const has = (m: number) => value.some((r) => r.minutes_before === m);
  const add = (m: number) => {
    if (has(m)) return;
    onChange([...value, { type: 'notification', minutes_before: m }].sort((a, b) => a.minutes_before - b.minutes_before));
  };
  const remove = (m: number) => onChange(value.filter((r) => r.minutes_before !== m));
  const toggle = (m: number) => (has(m) ? remove(m) : add(m));
  const addCustom = () => {
    const n = parseInt(customVal, 10);
    if (!Number.isFinite(n) || n < 0) return;
    const factor = customUnit === 'days' ? 1440 : customUnit === 'hours' ? 60 : 1;
    add(n * factor);
  };
  const customs = value.map((r) => r.minutes_before).filter((m) => !REMINDER_PRESETS.includes(m));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Preset toggle chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {REMINDER_PRESETS.map((m) => {
          const active = has(m);
          return (
            <button key={m} type="button" onClick={() => toggle(m)} style={chip(active)}>
              {reminderLabel(m)}
            </button>
          );
        })}
      </div>

      {/* Custom offset adder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Input
          type="number"
          min={0}
          value={customVal}
          onChange={(e) => setCustomVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          style={{ width: 72 }}
        />
        <Select value={customUnit} onValueChange={(v) => setCustomUnit(v as 'min' | 'hours' | 'days')}>
          <SelectTrigger style={{ width: 100 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="min">minutes</SelectItem>
            <SelectItem value="hours">hours</SelectItem>
            <SelectItem value="days">days</SelectItem>
          </SelectContent>
        </Select>
        <button type="button" onClick={addCustom} style={{ ...chip(false), fontWeight: 600 }}>Add</button>
      </div>

      {/* Selected custom offsets (presets already show active state above) */}
      {customs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {customs.map((m) => (
            <span key={m} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {reminderLabel(m)}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => remove(m)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: '0.75rem',
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
    background: active ? 'var(--amber-dim)' : 'transparent',
    color: active ? 'var(--amber)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
  };
}

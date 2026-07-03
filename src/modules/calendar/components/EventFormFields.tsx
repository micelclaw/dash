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

interface EventFormFieldsProps {
  form: EventFormState;
  onChange: (patch: Partial<EventFormState>) => void;
}

/** Campos del formulario de creación/edición de evento (modo edit/create del EventModal) */
export function EventFormFields({ form, onChange }: EventFormFieldsProps) {
  const calendarOptions = Object.keys(DEFAULT_CALENDAR_COLORS).filter((k) => k !== 'default');

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

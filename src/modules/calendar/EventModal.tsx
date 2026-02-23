import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Calendar, Users, Pencil, Trash2 } from 'lucide-react';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { formatTime, formatDateLong } from '@/lib/date-helpers';
import { getCalendarColor, DEFAULT_CALENDAR_COLORS } from './types';
import type { CalendarEvent, EventUpdateInput } from './types';
import type { LinkedRecord } from '@/types/links';

interface EventModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, input: EventUpdateInput) => Promise<CalendarEvent>;
  onDelete: (id: string) => Promise<void>;
  linkedRecords: LinkedRecord[];
  linkedRecordsLoading: boolean;
}

type Mode = 'view' | 'edit';

export function EventModal({
  event,
  open,
  onClose,
  onUpdate,
  onDelete,
  linkedRecords,
  linkedRecordsLoading,
}: EventModalProps) {
  const [mode, setMode] = useState<Mode>('view');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Edit form state
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [description, setDescription] = useState('');
  const [attendeesStr, setAttendeesStr] = useState('');

  // Sync form from event
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setStartAt(toLocalDatetime(event.start_at));
      setEndAt(event.end_at ? toLocalDatetime(event.end_at) : '');
      setAllDay(event.all_day);
      setLocation(event.location || '');
      setCalendarName(event.calendar_name);
      setDescription(event.description || '');
      setAttendeesStr(
        event.attendees.map((a) => a.email).join(', '),
      );
      setMode('view');
      setConfirmingDelete(false);
    }
  }, [event]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    if (!event) return;
    const input: EventUpdateInput = {
      title,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : undefined,
      all_day: allDay,
      location: location || undefined,
      calendar_name: calendarName,
      description: description || undefined,
      attendees: attendeesStr
        ? attendeesStr.split(',').map((e) => ({ email: e.trim() }))
        : [],
    };
    await onUpdate(event.id, input);
    setMode('view');
  }, [event, title, startAt, endAt, allDay, location, calendarName, description, attendeesStr, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!event) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await onDelete(event.id);
    onClose();
  }, [event, confirmingDelete, onDelete, onClose]);

  if (!open || !event) return null;

  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const color = getCalendarColor(event.calendar_name);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 'var(--z-modal-backdrop)' as unknown as number,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, 90vw)',
          maxHeight: '85vh',
          overflow: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 'var(--z-modal)' as unknown as number,
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            {mode === 'edit' ? 'Edit Event' : 'Event Details'}
          </span>
          <button onClick={onClose} style={closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', flex: 1, overflow: 'auto' }}>
          {mode === 'view' ? (
            <ViewMode
              event={event}
              start={start}
              end={end}
              color={color}
              linkedRecords={linkedRecords}
              linkedRecordsLoading={linkedRecordsLoading}
              onNavigate={onClose}
            />
          ) : (
            <EditMode
              title={title}
              setTitle={setTitle}
              startAt={startAt}
              setStartAt={setStartAt}
              endAt={endAt}
              setEndAt={setEndAt}
              allDay={allDay}
              setAllDay={setAllDay}
              location={location}
              setLocation={setLocation}
              calendarName={calendarName}
              setCalendarName={setCalendarName}
              description={description}
              setDescription={setDescription}
              attendeesStr={attendeesStr}
              setAttendeesStr={setAttendeesStr}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: mode === 'edit' ? 'flex-end' : 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            gap: 8,
          }}
        >
          {mode === 'view' ? (
            <>
              <button
                onClick={handleDelete}
                style={{
                  ...actionBtn,
                  color: confirmingDelete ? 'var(--error)' : 'var(--text-dim)',
                  borderColor: confirmingDelete ? 'var(--error)' : 'var(--border)',
                }}
              >
                <Trash2 size={14} />
                {confirmingDelete ? 'Are you sure?' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setMode('edit');
                  setConfirmingDelete(false);
                }}
                style={{ ...actionBtn, color: 'var(--amber)', borderColor: 'var(--amber)' }}
              >
                <Pencil size={14} />
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setMode('view');
                }}
                style={actionBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  ...actionBtn,
                  background: 'var(--amber)',
                  color: '#06060a',
                  borderColor: 'var(--amber)',
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  View mode                                                                 */
/* -------------------------------------------------------------------------- */

function ViewMode({
  event,
  start,
  end,
  color,
  linkedRecords,
  linkedRecordsLoading,
  onNavigate,
}: {
  event: CalendarEvent;
  start: Date;
  end: Date | null;
  color: string;
  linkedRecords: LinkedRecord[];
  linkedRecordsLoading: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Title */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
        {event.title}
      </h2>

      {/* Date / time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <Calendar size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text)' }}>
          {event.all_day
            ? formatDateLong(start)
            : `${formatDateLong(start)}, ${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`}
        </span>
      </div>

      {/* Location */}
      {event.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
          <MapPin size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{event.location}</span>
        </div>
      )}

      {/* Calendar badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--text-dim)' }}>{event.calendar_name}</span>
      </div>

      {/* Attendees */}
      {event.attendees.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem' }}>
          <Users size={14} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {event.attendees.map((a, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--surface)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  color: 'var(--text)',
                }}
              >
                {a.name || a.email}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text)',
            lineHeight: 1.5,
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {event.description}
        </div>
      )}

      {/* Related items */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <RelatedItemsPanel links={linkedRecords} loading={linkedRecordsLoading} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Edit mode                                                                 */
/* -------------------------------------------------------------------------- */

interface EditModeProps {
  title: string;
  setTitle: (v: string) => void;
  startAt: string;
  setStartAt: (v: string) => void;
  endAt: string;
  setEndAt: (v: string) => void;
  allDay: boolean;
  setAllDay: (v: boolean) => void;
  location: string;
  setLocation: (v: string) => void;
  calendarName: string;
  setCalendarName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  attendeesStr: string;
  setAttendeesStr: (v: string) => void;
}

function EditMode({
  title,
  setTitle,
  startAt,
  setStartAt,
  endAt,
  setEndAt,
  allDay,
  setAllDay,
  location,
  setLocation,
  calendarName,
  setCalendarName,
  description,
  setDescription,
  attendeesStr,
  setAttendeesStr,
}: EditModeProps) {
  const calendarOptions = Object.keys(DEFAULT_CALENDAR_COLORS).filter((k) => k !== 'default');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Title */}
      <div>
        <label style={labelStyle}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
          placeholder="Event title"
        />
      </div>

      {/* Date inputs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labelStyle}>Start</label>
          <input
            type={allDay ? 'date' : 'datetime-local'}
            value={allDay ? startAt.slice(0, 10) : startAt}
            onChange={(e) => setStartAt(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labelStyle}>End</label>
          <input
            type={allDay ? 'date' : 'datetime-local'}
            value={allDay ? endAt.slice(0, 10) : endAt}
            onChange={(e) => setEndAt(e.target.value)}
            style={inputStyle}
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
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          style={{ accentColor: 'var(--amber)', width: 14, height: 14 }}
        />
        All day
      </label>

      {/* Location */}
      <div>
        <label style={labelStyle}>Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={inputStyle}
          placeholder="Add location"
        />
      </div>

      {/* Calendar dropdown */}
      <div>
        <label style={labelStyle}>Calendar</label>
        <select
          value={calendarName}
          onChange={(e) => setCalendarName(e.target.value)}
          style={{
            ...inputStyle,
            cursor: 'pointer',
          }}
        >
          {calendarOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {!calendarOptions.includes(calendarName) && calendarName && (
            <option value={calendarName}>{calendarName}</option>
          )}
        </select>
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 60,
          }}
          placeholder="Add description"
        />
      </div>

      {/* Attendees */}
      <div>
        <label style={labelStyle}>Attendees (comma-separated emails)</label>
        <input
          value={attendeesStr}
          onChange={(e) => setAttendeesStr(e.target.value)}
          style={inputStyle}
          placeholder="alice@example.com, bob@example.com"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers / styles                                                          */
/* -------------------------------------------------------------------------- */

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const closeBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.8125rem',
  transition: `all var(--transition-fast)`,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
};

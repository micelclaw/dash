import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { toast } from 'sonner';
import { api } from '@/services/api';
import {
  getMonthGridDays,
  getWeekDayNames,
  addMonths,
  isSameDay,
  isSameMonth,
  isToday,
  formatMonthYear,
} from '@/lib/date-helpers';
import { getCalendarColor } from './types';
import type { CalendarEvent } from './types';

interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  source: string;
  visible: boolean;
}

interface CalendarMiniSidebarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  hiddenCalendars: Set<string>;
  onToggleCalendar: (name: string) => void;
  events: CalendarEvent[];
  onAddCalendar?: () => void;
  onRefresh?: () => void;
  calendars?: CalendarInfo[];
  onCalendarsChange?: () => void;
}

const DAY_NAMES = getWeekDayNames(1);

// Default calendars to always show in the list even if no events exist
const DEFAULT_CALENDARS = ['Personal', 'Work', 'Shared'];

export function CalendarMiniSidebar({
  currentDate,
  onDateChange,
  hiddenCalendars,
  onToggleCalendar,
  events,
  onAddCalendar,
  onRefresh,
  calendars: apiCalendars,
  onCalendarsChange,
}: CalendarMiniSidebarProps) {
  const [miniMonth, setMiniMonth] = useState(() => new Date(currentDate));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus();
  }, [renaming]);

  const handleRename = async (oldName: string) => {
    const newName = renameTo.trim();
    if (!newName || newName === oldName) { setRenaming(null); return; }
    try {
      // Batch update all events with this calendar_name
      const matching = events.filter(e => e.calendar_name === oldName);
      await Promise.all(matching.map(e =>
        api.patch(`/events/${e.id}`, { calendar_name: newName }),
      ));
      toast.success(`Renamed "${oldName}" to "${newName}"`);
      setRenaming(null);
      onRefresh?.();
    } catch {
      toast.error('Failed to rename calendar');
    }
  };

  const handleDeleteCalendar = async (cal: CalendarInfo) => {
    const matching = events.filter(e => e.calendar_name === cal.name);
    const msg = matching.length > 0
      ? `Delete "${cal.name}" and its ${matching.length} events? This cannot be undone.`
      : `Delete calendar "${cal.name}"?`;
    if (!confirm(msg)) return;
    try {
      // Delete via API (also deletes events on the backend)
      await api.delete(`/calendars/${cal.id}`);
      toast.success(`Calendar "${cal.name}" deleted`);
      onCalendarsChange?.();
      onRefresh?.();
    } catch {
      toast.error('Failed to delete calendar');
    }
  };

  const gridDays = useMemo(() => getMonthGridDays(miniMonth), [miniMonth]);

  // Build a set of date strings that have events for dot indicators
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of events) {
      const d = new Date(ev.start_at);
      dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return dates;
  }, [events]);

  // Calendar list: use API calendars if available, else derive from events
  const calendarList = useMemo(() => {
    if (apiCalendars && apiCalendars.length > 0) {
      // Merge API calendars with any event calendar_names not in the list
      const apiNames = new Set(apiCalendars.map(c => c.name));
      const extras: CalendarInfo[] = [];
      for (const ev of events) {
        if (ev.calendar_name && !apiNames.has(ev.calendar_name)) {
          apiNames.add(ev.calendar_name);
          extras.push({
            id: ev.calendar_name,
            name: ev.calendar_name,
            color: getCalendarColor(ev.calendar_name),
            source: ev.source === 'caldav' ? 'caldav' : 'local',
            visible: true,
          });
        }
      }
      return [...apiCalendars, ...extras];
    }
    // Fallback: derive from events + defaults
    const names = new Set<string>(DEFAULT_CALENDARS);
    for (const ev of events) {
      if (ev.calendar_name) names.add(ev.calendar_name);
    }
    return Array.from(names).map(name => ({
      id: name, name, color: getCalendarColor(name), source: 'local', visible: true,
    }));
  }, [apiCalendars, events]);

  const hasEvent = (d: Date) =>
    eventDates.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-sans)',
        borderRight: '1px solid var(--border)',
        overflow: 'auto',
      }}
    >
      {/* Mini calendar header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 8px',
        }}
      >
        <button onClick={() => setMiniMonth(addMonths(miniMonth, -1))} style={navBtn}>
          <ChevronLeft size={14} />
        </button>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {formatMonthYear(miniMonth)}
        </span>
        <button onClick={() => setMiniMonth(addMonths(miniMonth, 1))} style={navBtn}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 8px',
        }}
      >
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            style={{
              textAlign: 'center',
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
              padding: '2px 0',
            }}
          >
            {name.charAt(0)}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 8px 12px',
          gap: 1,
        }}
      >
        {gridDays.map((day, i) => {
          const inMonth = isSameMonth(day, miniMonth);
          const today = isToday(day);
          const selected = isSameDay(day, currentDate);
          const hasEv = hasEvent(day);

          return (
            <button
              key={i}
              onClick={() => onDateChange(day)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 30,
                margin: '0 auto',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.6875rem',
                fontWeight: today ? 700 : 400,
                background: selected
                  ? 'var(--amber)'
                  : today
                    ? 'var(--amber-dim)'
                    : 'transparent',
                color: selected
                  ? '#06060a'
                  : today
                    ? 'var(--amber)'
                    : inMonth
                      ? 'var(--text)'
                      : 'var(--text-muted)',
                transition: `background var(--transition-fast)`,
                position: 'relative',
              }}
            >
              {day.getDate()}
              {hasEv && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: selected ? '#06060a' : 'var(--amber)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

      {/* Calendar list */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          Calendars
        </div>
        {calendarList.map((cal) => {
          const name = cal.name;
          const color = cal.color;
          const hidden = hiddenCalendars.has(name);
          const isRenaming = renaming === name;

          if (isRenaming) {
            return (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                <input
                  ref={renameRef}
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(name);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={() => handleRename(name)}
                  style={{
                    flex: 1,
                    padding: '2px 6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--amber)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>
            );
          }

          return (
            <ContextMenu
              key={name}
              trigger={
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    color: hidden ? 'var(--text-muted)' : 'var(--text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => onToggleCalendar(name)}
                    style={{
                      accentColor: color,
                      width: 14,
                      height: 14,
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                      opacity: hidden ? 0.3 : 1,
                    }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                </label>
              }
              items={[
                { label: 'Rename', icon: Pencil, onClick: () => { setRenameTo(name); setRenaming(name); } },
                { label: '', icon: undefined, onClick: () => {}, separator: true },
                { label: 'Delete', icon: Trash2, onClick: () => handleDeleteCalendar(cal), variant: 'danger' as const },
              ]}
            />
          );
        })}

        {/* Add calendar button */}
        <button
          onClick={onAddCalendar}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            padding: '6px 0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--amber)',
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={14} />
          Add calendar
        </button>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

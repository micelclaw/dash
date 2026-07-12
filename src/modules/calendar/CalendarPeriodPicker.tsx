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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  startOfMonth, addMonths, addDays, getMonthGridDays, getWeekDayNames,
  getISOWeek, getISOWeeksInYear, mondayOfISOWeek, startOfWeek,
  isSameDay, isSameMonth, isToday,
} from '@/lib/date-helpers';
import type { CalendarView } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  view: CalendarView;
  currentDate: Date;
  onDateChange: (d: Date) => void;
  /** The clickable title element (rendered as the Popover trigger). */
  children: React.ReactNode;
}

/**
 * Tap-the-title period picker for Calendar. In month view it shows a 12-month
 * grid (with year nav); in week view a list of ISO weeks W1..W53; in day view a
 * mini-month day picker. Agenda has no picker (the toolbar renders the title
 * plainly). Picking a period sets currentDate and closes.
 */
export function CalendarPeriodPicker({ view, currentDate, onDateChange, children }: Props) {
  const [open, setOpen] = useState(false);
  // Local navigation state inside the popover (doesn't move currentDate until a pick).
  const [pivot, setPivot] = useState(currentDate);

  // Re-seed the pivot each time it opens so it reflects the current period.
  const onOpenChange = (v: boolean) => {
    if (v) setPivot(currentDate);
    setOpen(v);
  };

  const pick = (d: Date) => { onDateChange(d); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" style={{ width: view === 'week' ? 260 : 240, padding: 8 }}>
        {view === 'month' && <MonthPicker pivot={pivot} setPivot={setPivot} currentDate={currentDate} onPick={pick} />}
        {view === 'week' && <WeekPicker pivot={pivot} setPivot={setPivot} currentDate={currentDate} onPick={pick} />}
        {view === 'day' && <DayPicker pivot={pivot} setPivot={setPivot} currentDate={currentDate} onPick={pick} />}
      </PopoverContent>
    </Popover>
  );
}

// ── Year header (prev/next year) ────────────────────────────────────
function YearNav({ year, onDelta }: { year: number; onDelta: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <button onClick={() => onDelta(-1)} style={navBtn} aria-label="Previous year"><ChevronLeft size={16} /></button>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{year}</span>
      <button onClick={() => onDelta(1)} style={navBtn} aria-label="Next year"><ChevronRight size={16} /></button>
    </div>
  );
}

// ── Month picker: 12-month grid ─────────────────────────────────────
function MonthPicker({ pivot, setPivot, currentDate, onPick }: PickerBodyProps) {
  const year = pivot.getFullYear();
  return (
    <div>
      <YearNav year={year} onDelta={(n) => setPivot(new Date(year + n, pivot.getMonth(), 1))} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {MONTHS.map((m, i) => {
          const active = currentDate.getFullYear() === year && currentDate.getMonth() === i;
          return (
            <button key={m} onClick={() => onPick(new Date(year, i, 1))} style={cellBtn(active)}>{m}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Week picker: W1..W53 list ───────────────────────────────────────
function WeekPicker({ pivot, setPivot, currentDate, onPick }: PickerBodyProps) {
  const year = pivot.getFullYear();
  const count = getISOWeeksInYear(year);
  const activeWeek = currentDate.getFullYear() === year ? getISOWeek(currentDate) : -1;
  return (
    <div>
      <YearNav year={year} onDelta={(n) => setPivot(new Date(year + n, 0, 4))} />
      <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: count }, (_, idx) => {
          const w = idx + 1;
          const monday = mondayOfISOWeek(w, year);
          const sunday = addDays(monday, 6);
          const range = `${monday.getDate()} ${MONTHS[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
          const active = w === activeWeek;
          return (
            <button key={w} onClick={() => onPick(monday)} style={{ ...rowBtn(active), display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>W{w}</span>
              <span style={{ color: active ? 'inherit' : 'var(--text-dim)' }}>{range}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day picker: mini month ──────────────────────────────────────────
function DayPicker({ pivot, setPivot, currentDate, onPick }: PickerBodyProps) {
  const days = getMonthGridDays(pivot);
  const names = getWeekDayNames();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={() => setPivot(addMonths(pivot, -1))} style={navBtn} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          {MONTHS[pivot.getMonth()]} {pivot.getFullYear()}
        </span>
        <button onClick={() => setPivot(addMonths(pivot, 1))} style={navBtn} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {names.map((n) => (
          <div key={n} style={{ textAlign: 'center', fontSize: '0.625rem', color: 'var(--text-muted)', padding: '2px 0' }}>{n}</div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, pivot);
          const active = isSameDay(d, currentDate);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              style={{
                ...dayBtn(active),
                color: active ? '#06060a' : inMonth ? 'var(--text)' : 'var(--text-muted)',
                border: !active && isToday(d) ? '1px solid var(--amber)' : '1px solid transparent',
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PickerBodyProps {
  pivot: Date;
  setPivot: (d: Date) => void;
  currentDate: Date;
  onPick: (d: Date) => void;
}

const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', width: 24, height: 24, borderRadius: 'var(--radius-sm)',
};
const cellBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 0', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
  borderRadius: 'var(--radius-sm)', border: 'none',
  background: active ? 'var(--amber)' : 'var(--surface)',
  color: active ? '#06060a' : 'var(--text)',
  fontFamily: 'var(--font-sans)',
});
const rowBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 8px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left',
  borderRadius: 'var(--radius-sm)', border: 'none',
  background: active ? 'var(--amber)' : 'transparent',
  color: active ? '#06060a' : 'var(--text)',
  fontFamily: 'var(--font-sans)',
});
const dayBtn = (active: boolean): React.CSSProperties => ({
  aspectRatio: '1', fontSize: '0.6875rem', cursor: 'pointer',
  borderRadius: 'var(--radius-sm)', background: active ? 'var(--amber)' : 'transparent',
  fontFamily: 'var(--font-sans)', padding: 0,
});

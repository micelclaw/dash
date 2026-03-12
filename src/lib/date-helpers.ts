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

/** Zero-dependency date helpers used across Calendar, Diary, and other modules. */

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function startOfWeek(d: Date, weekStartsOn = 1): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfWeek(d: Date, weekStartsOn = 1): Date {
  const r = startOfWeek(d, weekStartsOn);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function formatRelative(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDateShort(d);
}

/** Get day names for the week starting on given day (default Monday) */
export function getWeekDayNames(weekStartsOn = 1): string[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...days.slice(weekStartsOn), ...days.slice(0, weekStartsOn)];
}

/** Get all days visible in a month grid (includes padding from prev/next months) */
export function getMonthGridDays(d: Date, weekStartsOn = 1): Date[] {
  const first = startOfMonth(d);
  const start = startOfWeek(first, weekStartsOn);
  const days: Date[] = [];
  let current = new Date(start);
  // Always show 6 weeks (42 days) for consistent grid height
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** Get the days of a week starting from a given date */
export function getWeekDays(d: Date, weekStartsOn = 1): Date[] {
  const start = startOfWeek(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Format a date range label based on calendar view */
export function formatRangeLabel(
  view: 'day' | 'week' | 'month' | 'agenda',
  currentDate: Date,
): string {
  switch (view) {
    case 'day':
      return formatDateLong(currentDate);
    case 'week': {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
      }
      return `${formatDateShort(start)} – ${formatDateShort(end)} ${end.getFullYear()}`;
    }
    case 'month':
      return formatMonthYear(currentDate);
    case 'agenda':
      return 'Upcoming';
  }
}

/** Navigate date by view (add/subtract one unit) */
export function navigateDate(
  view: 'day' | 'week' | 'month' | 'agenda',
  currentDate: Date,
  direction: 1 | -1,
): Date {
  switch (view) {
    case 'day':
      return addDays(currentDate, direction);
    case 'week':
      return addDays(currentDate, direction * 7);
    case 'month':
    case 'agenda':
      return addMonths(currentDate, direction);
  }
}

export function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

export function isThisWeek(d: Date): boolean {
  const now = new Date();
  const ws = startOfWeek(now, 1);
  return d >= ws && d <= now;
}

export function isThisYear(d: Date): boolean {
  return d.getFullYear() === new Date().getFullYear();
}

/** Smart email time: "14:02" / "Yesterday" / "Mon" / "Feb 16" / "Feb 16, 2025" */
export function formatEmailTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  if (isSameDay(d, now)) return formatTime(d);
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return d.toLocaleDateString('en', { weekday: 'short' });
  if (isThisYear(d)) return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Get next occurrence of a weekday (0=Sun, 1=Mon, ...) */
export function getNextWeekday(d: Date, weekday: number): Date {
  const r = new Date(d);
  const diff = (weekday - r.getDay() + 7) % 7 || 7;
  r.setDate(r.getDate() + diff);
  return r;
}

/** Get date range (from/to ISO strings) for a given view and date */
export function getDateRange(
  view: 'day' | 'week' | 'month' | 'agenda',
  currentDate: Date,
): { from: string; to: string } {
  switch (view) {
    case 'day':
      return {
        from: startOfDay(currentDate).toISOString(),
        to: endOfDay(currentDate).toISOString(),
      };
    case 'week':
      return {
        from: startOfWeek(currentDate).toISOString(),
        to: endOfWeek(currentDate).toISOString(),
      };
    case 'month':
      return {
        from: startOfMonth(currentDate).toISOString(),
        to: endOfMonth(currentDate).toISOString(),
      };
    case 'agenda':
      return {
        from: startOfDay(currentDate).toISOString(),
        to: addDays(currentDate, 30).toISOString(),
      };
  }
}

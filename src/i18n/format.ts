import type { Locale } from './core';

type DatePreferences = { timezone?: string; date_format?: string; time_format?: string };

function getDateParts(date: Date, locale: Locale, timeZone?: string): Intl.DateTimeFormatPart[] {
  const lang = locale === 'es' ? 'es-ES' : 'en-US';
  const options: Intl.DateTimeFormatOptions = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
  try { return new Intl.DateTimeFormat(lang, options).formatToParts(date); }
  catch { options.timeZone = undefined; return new Intl.DateTimeFormat(lang, options).formatToParts(date); }
}

/** Date portion honoring the saved order. Civil dates can omit timeZone to avoid changing their day. */
export function formatDate(date: Date, locale: Locale, preferences?: DatePreferences, timeZone?: string): string {
  if (!Number.isFinite(date.getTime())) return '';
  const parts = getDateParts(date, locale, timeZone);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const day = part('day'); const month = part('month'); const year = part('year');
  return preferences?.date_format === 'DD/MM/YYYY' ? `${day}/${month}/${year}`
    : preferences?.date_format === 'MM/DD/YYYY' ? `${month}/${day}/${year}` : `${year}-${month}-${day}`;
}

/** Time portion honoring the saved 12/24-hour choice and IANA timezone. */
export function formatTime(date: Date, locale: Locale, preferences?: DatePreferences): string {
  if (!Number.isFinite(date.getTime())) return '';
  const lang = locale === 'es' ? 'es-ES' : 'en-US';
  const clock: Intl.DateTimeFormatOptions = preferences?.time_format === '12h' ? { hour12: true } : { hourCycle: 'h23' };
  try {
    return new Intl.DateTimeFormat(lang, { timeZone: preferences?.timezone, hour: '2-digit', minute: '2-digit', ...clock }).format(date);
  } catch {
    return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', ...clock }).format(date);
  }
}

/** Calendar event labels follow the browser-local grid until the grid itself becomes timezone-aware. */
export function formatGridTime(date: Date, locale: Locale, preferences?: DatePreferences, gridTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  return formatTime(date, locale, { ...preferences, timezone: gridTimeZone });
}

/** Timed calendar events use the same zone as their visual grid position. */
export function formatGridDateTime(date: Date, locale: Locale, preferences?: DatePreferences, gridTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  if (!Number.isFinite(date.getTime())) return '';
  return `${formatDate(date, locale, preferences, gridTimeZone)} ${formatGridTime(date, locale, preferences, gridTimeZone)}`;
}

/** Display dates without changing the stored timestamp or the user's format choices. */
export function formatDateTime(date: Date, locale: Locale, preferences?: DatePreferences): string {
  if (!Number.isFinite(date.getTime())) return '';
  return `${formatDate(date, locale, preferences, preferences?.timezone)} ${formatTime(date, locale, preferences)}`;
}

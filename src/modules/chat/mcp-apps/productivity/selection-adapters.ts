import type { ProductivityContext } from './types';

export function pageSize(context: ProductivityContext, fallback = 25): number {
 const value = context.selection.params.limit;
 return typeof value === 'number' && Number.isInteger(value) && value > 0 ? Math.min(100, value) : fallback;
}
export function pageOffset(context: ProductivityContext): number {
 const value = context.selection.params.offset;
 return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}
const day = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const selectedDay = (value: string) => {
 const parsed = new Date(value);
 // A date-only selection is a civil day, not an instant to convert to the viewer's zone.
 if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
 return day(parsed);
};
export function calendarSelectionRange(context: ProductivityContext, now = new Date()) {
 const params = context.selection.params; const start = new Date(now); const end = new Date(now);
 if (params.date === 'tomorrow') { start.setDate(start.getDate() + 1); end.setDate(end.getDate() + 1); }
 else if (params.date === 'this_week' || params.date === 'week') { start.setDate(start.getDate() - (start.getDay() + 6) % 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 6); }
 else if (params.date === 'this_month' || params.date === 'month') { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
 else if (typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) return { from: params.date, to: params.date };
 else if (params.date !== 'today') end.setDate(end.getDate() + 30);
 return { from: typeof params.from === 'string' ? selectedDay(params.from) : day(start), to: typeof params.to === 'string' ? selectedDay(params.to) : day(end) };
}

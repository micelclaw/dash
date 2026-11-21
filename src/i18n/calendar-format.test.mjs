import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({ root, configFile: false, resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' });
after(() => vite.close());
const { formatDate, formatDateTime, formatGridDateTime, formatGridTime, formatTime } = await vite.ssrLoadModule('/src/i18n/format.ts');

test('calendar time display respects confirmed 12h/24h and timezone preferences', () => {
  const instant = new Date('2026-11-16T23:05:00Z');
  assert.equal(formatTime(instant, 'en', { timezone: 'Europe/Madrid', time_format: '24h' }), '00:05');
  assert.match(formatTime(instant, 'en', { timezone: 'UTC', time_format: '12h' }), /^11:05\s*PM$/i);
  assert.equal(formatDateTime(instant, 'es', { timezone: 'Europe/Madrid', date_format: 'DD/MM/YYYY', time_format: '24h' }), '17/11/2026 00:05');
});

test('civil date display honors date order without shifting the diary day by timezone', () => {
  const civilDate = new Date('2026-11-16T12:00:00');
  assert.equal(formatDate(civilDate, 'es', { timezone: 'Pacific/Kiritimati', date_format: 'DD/MM/YYYY' }), '16/11/2026');
  assert.equal(formatDate(civilDate, 'en', { timezone: 'Pacific/Honolulu', date_format: 'MM/DD/YYYY' }), '11/16/2026');
});

test('calendar event labels stay in the grid zone when configured timezone differs', () => {
  const instant = new Date('2026-01-01T00:30:00Z');
  const preferences = { timezone: 'Asia/Tokyo', date_format: 'MM/DD/YYYY', time_format: '12h' };
  assert.equal(formatGridDateTime(instant, 'en', preferences, 'America/Los_Angeles'), '12/31/2025 04:30 PM');
  assert.equal(formatGridTime(instant, 'en', { ...preferences, time_format: '24h' }, 'America/Los_Angeles'), '16:30');
  assert.equal(formatGridTime(instant, 'en', { ...preferences, time_format: '24h' }, 'Asia/Tokyo'), '09:30');
  assert.equal(instant.toISOString(), '2026-01-01T00:30:00.000Z');
});

import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({ root, configFile: false, resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' });
after(() => vite.close());
const { formatRelativeTime } = await vite.ssrLoadModule('/src/modules/agents/shared/format.ts');

test('agent activity times switch language while legacy callers keep Spanish', () => {
  const originalNow = Date.now;
  const now = Date.parse('2026-11-17T12:00:00Z');
  Date.now = () => now;
  try {
    assert.equal(formatRelativeTime(null), 'nunca');
    assert.equal(formatRelativeTime(null, 'en'), 'never');
    const minuteAgo = new Date(now - 60_000).toISOString();
    assert.equal(formatRelativeTime(minuteAgo), 'hace 1 min');
    assert.equal(formatRelativeTime(minuteAgo, 'en'), '1 min ago');
    const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60_000).toISOString();
    assert.equal(formatRelativeTime(twoMonthsAgo, 'es'), 'hace 2 meses');
    assert.equal(formatRelativeTime(twoMonthsAgo, 'en'), '2 months ago');
  } finally {
    Date.now = originalNow;
  }
});

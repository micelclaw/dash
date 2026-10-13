import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { eventStatsSections, formatEventBusUptime, shouldFetchEventStats } from './event-stats-view.ts';

const stats = {
  uptime_seconds: 3_661,
  total_emits: 8,
  validation_rejects: 1,
  subscriptions: 2,
  latency_ms: { p50: 1, p95: 9, p99: 12, samples: 8 },
  count_by_severity: { info: 8 },
  top_types: [{ type: 'chat.begin', count: 5 }],
  backlog: { unprocessed: 4, unprocessed_older_1h: 2, unprocessed_older_24h: 1, unprocessed_warn_plus: 1 },
  registered_schemas: [],
};

test('E2: uptime is formatted and process counters remain separate from persistent backlog', () => {
  assert.equal(formatEventBusUptime(0), '0m');
  assert.equal(formatEventBusUptime(3_661), '1h 1m');
  const sections = eventStatsSections(stats);
  assert.deepEqual(sections.sinceStart[0], ['Uptime', '1h 1m']);
  assert.ok(sections.sinceStart.some(([label]) => label === 'Emits'));
  assert.ok(sections.backlog.some(([label, value]) => label === 'Pending' && value === 4));
  assert.equal(sections.sinceStart.some(([label]) => label === 'Pending'), false);
});

test('E2: collapsed panel does not fetch; opening without data fetches and refresh remains available', () => {
  assert.equal(shouldFetchEventStats(false, false), false);
  assert.equal(shouldFetchEventStats(true, false), true);
  assert.equal(shouldFetchEventStats(true, true), false);
});

test('E2: the real Events UI keeps process counters, persistent backlog, refresh, and collapse wired', () => {
  const tab = readFileSync('src/modules/activity/tabs/EventsTab.tsx', 'utf8');
  assert.match(tab, /setStatsOpen\(\(open\) => !open\)/);
  assert.match(tab, /aria-expanded=\{statsOpen\}/);
  assert.match(tab, /shouldFetchEventStats\(statsOpen, !!busStats\)/);
  assert.match(tab, /Refresh statistics/);
  assert.match(tab, /onClick=\{\(\) => void loadStats\(\)\}/);
  assert.match(tab, /<StatsSection label="Since this Core started" rows=\{sections\.sinceStart\}/);
  assert.match(tab, /<StatsSection label="Persistent backlog" rows=\{sections\.backlog\}/);
  assert.match(tab, /catch \{ setStatsError\('Statistics are unavailable for this account\.'\); \}/);
});

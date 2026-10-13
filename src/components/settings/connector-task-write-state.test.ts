import assert from 'node:assert/strict';
import test from 'node:test';
import { taskWritePresentation } from './connector-task-write-state.ts';

test('task connector reports unsupported, uncertified, and per-connection states separately', () => {
  assert.match(taskWritePresentation({ domains: ['tasks'], task_write_supported: false })!.title, /not supported/);
  assert.match(taskWritePresentation({ domains: ['tasks'], task_write_supported: true })!.title, /not certified/);
  assert.match(taskWritePresentation({
    domains: ['tasks'], task_write_supported: true, task_write_certified: true,
  })!.title, /writing blocked for this connection/);
  assert.match(taskWritePresentation({
    domains: ['tasks'], task_write_supported: true, task_write_certified: true, task_write_enabled: true,
  })!.title, /writing enabled for this connection/);
});

test('non-task connectors do not render task write status', () => {
  assert.equal(taskWritePresentation({ domains: ['events'], task_write_supported: true }), null);
});

test('unknown pending count is not presented as zero and does not expose an enable action', () => {
  const state = taskWritePresentation({
    domains: ['tasks'], task_write_supported: true, task_pending_change_count: null,
  });
  assert.match(state!.pendingText, /Could not check/);
  assert.equal(state!.blocked, true);
});

test('pending count is displayed as an aggregate without card content', () => {
  const state = taskWritePresentation({
    domains: ['tasks'], task_write_supported: true, task_pending_change_count: 3,
  });
  assert.equal(state!.pendingText, '3 local changes waiting to sync.');
  assert.equal(state!.pendingCount, 3);
});

test('singular pending count uses singular wording', () => {
  const state = taskWritePresentation({ domains: ['tasks'], task_pending_change_count: 1 });
  assert.equal(state!.pendingText, '1 local change waiting to sync.');
});

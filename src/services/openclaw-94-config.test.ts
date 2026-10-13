import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sanitizeCanvasConfigPayload,
  sanitizeLoggingConfigPayload,
  sanitizeMemoryConfigPayload,
  sanitizeMessagesConfigPayload,
  sanitizeSessionConfigPayload,
  sanitizeUiConfigPayload,
} from './openclaw-94-config.ts';

test('memory payload keeps 9.4 search fields and omits retired tuning controls', () => {
  const payload = sanitizeMemoryConfigPayload({
    memorySearch: {
      enabled: true,
      provider: 'auto',
      chunking: { tokens: 400, overlap: 80 },
      sync: { watch: true },
      chunkSize: 400,
      chunk_overlap: 80,
      maxResults: 99,
      qmd: { command: 'retired' },
      query: {
        maxResults: 8,
        minScore: 0.1,
        hybrid: { enabled: true },
        mmr: { enabled: true },
        temporalDecay: { enabled: true },
        vectorWeight: 0.7,
        textWeight: 0.3,
      },
      cache: { enabled: true },
    },
    memory: { backend: 'qmd', qmd: { command: 'qmd' }, citations: 'auto' },
    memoryLancedb: {
      dbPath: 's3://memory/index',
      storageOptions: {
        region: 'test-region',
        access_key_id: '${TEST_ACCESS}',
        secretAccessKey: '${TEST_SECRET}',
      },
    },
  });

  assert.deepEqual(payload, {
    memorySearch: {
      enabled: true,
      provider: 'openai',
      query: { maxResults: 8, minScore: 0.1 },
      cache: { enabled: true },
    },
    memory: { citations: 'auto' },
    memoryLancedb: {
      dbPath: 's3://memory/index',
      storageOptions: {
        region: 'test-region',
        access_key: '${TEST_ACCESS}',
        secret_key: '${TEST_SECRET}',
      },
    },
  });
});

test('message payload maps Dash reaction fields and omits retired message fields', () => {
  const input = {
    queue: { mode: 'collect', cap: 20, debounceMs: 1_000, debounce_ms: 1_000 },
    inbound: { debounceMs: 2_000 },
    status_reactions: { enabled: true, timing: { thinking: 100 } },
    ack_reaction: null,
    ack_reaction_scope: 'all',
  };

  assert.deepEqual(sanitizeMessagesConfigPayload(input), {
    queue: { mode: 'collect', cap: 20 },
    inbound: { debounceMs: 2_000 },
    statusReactions: { enabled: true },
    ackReaction: null,
    ackReactionScope: 'all',
  });
  assert.equal(input.queue.debounceMs, 1_000, 'sanitizer must not mutate component state');
});

test('session payload omits the whole retired session collaboration block and locks', () => {
  assert.deepEqual(sanitizeSessionConfigPayload({
    dmScope: 'per-channel-peer',
    agentToAgent: { enabled: true, allow: ['planner'], maxPingPongTurns: 3 },
    typingIntervalSeconds: 6,
    write_lock: { timeout_ms: 2_000 },
    reset: { mode: 'disabled' },
  }), {
    dmScope: 'per-channel-peer',
    reset: { mode: 'none' },
  });

  assert.deepEqual(sanitizeSessionConfigPayload({
    agent_to_agent: { max_ping_pong_turns: 3 },
  }), {});
});

test('logging payload normalizes compact and preserves an explicit file deletion', () => {
  assert.deepEqual(sanitizeLoggingConfigPayload({
    level: 'info',
    console_style: 'compact',
    file: undefined,
    redact_sensitive: 'off',
    redactSensitive: 'off',
    redact_patterns: ['token=.*'],
  }), {
    level: 'info',
    console_style: 'pretty',
    file: null,
    redact_patterns: ['token=.*'],
  });
  assert.equal(JSON.stringify(sanitizeLoggingConfigPayload({ file: undefined })), '{"file":null}');
});

test('canvas payload only emits the 9.4 host enabled flag', () => {
  assert.deepEqual(sanitizeCanvasConfigPayload({
    enabled: true,
    root: '/tmp/canvas',
    port: 18_793,
    live_reload: true,
    canvasHost: { enabled: true },
  }), { enabled: true });
});

test('UI payload preserves seam color without reintroducing global assistant identity', () => {
  assert.deepEqual(sanitizeUiConfigPayload({
    seam_color: '#d4a017',
    assistant: { name: 'Claw', avatar: '/avatar.png' },
  }), { seam_color: '#d4a017' });
});

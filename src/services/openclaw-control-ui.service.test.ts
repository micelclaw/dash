import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { __test__ } from './openclaw-control-ui.service.ts';

describe('OpenClaw Control UI Dash handoff', () => {
  class TestApiError extends Error {
    constructor(public code: string, message: string, public details?: Record<string, unknown>, public status?: number) {
      super(message);
    }
  }

  it('constructs only an HTTPS host-local bootstrap URL', () => {
    assert.equal(
      __test__.controlUiUrl('openclaw.victor.claw', '/__micelclaw__/control-ui/bootstrap'),
      'https://openclaw.victor.claw/__micelclaw__/control-ui/bootstrap',
    );
  });

  it('retries a temporary Gateway reload without navigating before the cookie is ready', async () => {
    let calls = 0;
    let elapsed = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls++;
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ephemeral-test-token');
      assert.equal(init?.credentials, 'include');
      return calls === 1
        ? new Response('', { status: 503, headers: { 'retry-after': '1' } })
        : new Response(null, { status: 204 });
    };
    await __test__.bootstrapControlUi('https://openclaw.victor.claw/__micelclaw__/control-ui/bootstrap',
      () => 'ephemeral-test-token', TestApiError, {
        fetcher,
        wait: async (ms) => { elapsed += ms; },
        now: () => elapsed,
        maxWaitMs: 5_000,
      });
    assert.equal(calls, 2);
    assert.equal(elapsed, 1_000);
  });

  it('never retries a definitive authorization failure', async () => {
    let calls = 0;
    await assert.rejects(
      __test__.bootstrapControlUi('https://openclaw.victor.claw/__micelclaw__/control-ui/bootstrap',
        () => 'ephemeral-test-token', TestApiError, {
          fetcher: async () => { calls++; return new Response('', { status: 403 }); },
          wait: async () => { throw new Error('403 must not wait'); },
        }),
      (error: unknown) => error instanceof TestApiError && error.status === 403,
    );
    assert.equal(calls, 1);
  });

  it('stops after repeated browser network failures instead of leaving a blank tab', async () => {
    let calls = 0;
    let elapsed = 0;
    const progress: string[] = [];
    await assert.rejects(
      __test__.bootstrapControlUi('https://openclaw.victor.claw/__micelclaw__/control-ui/bootstrap',
        () => 'ephemeral-test-token', TestApiError, {
          fetcher: async () => { calls++; throw new TypeError('Failed to fetch'); },
          wait: async (ms) => { elapsed += ms; },
          now: () => elapsed,
          maxWaitMs: 30_000,
          onProgress: (message) => progress.push(message),
        }),
      (error: unknown) => error instanceof TestApiError && error.code === 'OPENCLAW_CONTROL_UI_NETWORK',
    );
    assert.equal(calls, 3);
    assert.equal(elapsed, 6_000);
    assert.equal(progress.length, 2);
  });
});

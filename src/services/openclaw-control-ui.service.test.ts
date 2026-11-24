import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

class DiscoveryApiError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>, public status?: number) { super(message); }
}
let fixtureDiscovery: { data: { host: string; bootstrap_path: string; ready: boolean; https_port?: unknown } };
let fixtureGeneration = 1;
let fixtureOwner = 'synthetic-human-fixture';
let afterDiscovery = () => {};
const authListeners = new Set<() => void>();
function changeFixtureOwner(): void {
  fixtureGeneration++; fixtureOwner = 'synthetic-next-human';
  for (const listener of authListeners) listener();
}
mock.module(new URL('./api.ts', import.meta.url).href, { namedExports: { ApiError: DiscoveryApiError, api: { post: async (path: string) => {
  assert.equal(path, '/auth/openclaw-control-ui'); afterDiscovery(); return fixtureDiscovery;
} } } });
mock.module(new URL('../stores/auth.store.ts', import.meta.url).href, { namedExports: { useAuthStore: {
  getState: () => ({ sessionGeneration: fixtureGeneration, user: { id: fixtureOwner }, logoutState: 'idle', tokens: { accessToken: 'synthetic-discovery-credential' } }),
  subscribe: (listener: () => void) => { authListeners.add(listener); return () => authListeners.delete(listener); },
} } });
const { __test__, openOpenclawControlUi, prepareOpenclawControlUi } = await import('./openclaw-control-ui.service.ts');

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

  it('rejects a successful late bootstrap after its host was disposed', async () => {
    let closed = false;
    await assert.rejects(__test__.bootstrapControlUi('https://openclaw.qa.claw/__micelclaw__/control-ui/bootstrap',
      () => 'synthetic-bootstrap-only', TestApiError, {
        isClosed: () => closed,
        fetcher: async () => { closed = true; return new Response(null, { status: 204 }); },
      }), (error: unknown) => error instanceof DiscoveryApiError && error.code === 'OPENCLAW_CONTROL_UI_CLOSED');
  });

  it('does not treat cancellation as a transient network failure', async () => {
    const abort = new AbortController();
    let calls = 0;
    await assert.rejects(__test__.bootstrapControlUi('https://openclaw.qa.claw/__micelclaw__/control-ui/bootstrap',
      () => 'synthetic-bootstrap-only', TestApiError, {
        signal: abort.signal,
        fetcher: async () => { calls++; abort.abort(); throw new TypeError('interrupted'); },
        wait: async () => { throw new Error('must not retry'); },
      }));
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

describe('effective Control UI discovery origin', () => {
  it('preserves 443 and the discovered non-default HTTPS port while rejecting unsafe URL components', () => {
    assert.equal(__test__.controlUiUrl('openclaw.qa107.claw', '/', 18666), 'https://openclaw.qa107.claw:18666/');
    assert.equal(__test__.controlUiUrl('openclaw.qa107.claw', '/', 443), 'https://openclaw.qa107.claw/');
    for (const host of ['https://foreign.test', 'user@foreign.test', 'openclaw.qa107.claw:18666', 'openclaw..qa107.claw', 'Openclaw.qa107.claw']) assert.throws(() => __test__.controlUiUrl(host, '/', 18666));
    for (const port of [0, 65536, 1.5, NaN]) assert.throws(() => __test__.controlUiUrl('openclaw.qa107.claw', '/', port));
    for (const path of ['//foreign.test', '@foreign.test', '/__micelclaw__/control-ui/bootstrap?token=fixture', '/login']) assert.throws(() => __test__.controlUiUrl('openclaw.qa107.claw', path, 18666));
  });
});

describe('real Dash open handoff with popup/HTTP fixtures, no browser window', () => {
  for (const port of [18666, undefined]) it(`bootstraps and navigates only after success with discovered port ${port ?? 'legacy443'}`, async (t) => {
    fixtureDiscovery = { data: { host: 'openclaw.qa107.claw', bootstrap_path: '/__micelclaw__/control-ui/bootstrap', ready: true, https_port: port } };
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const navigations: string[] = [], status = { textContent: '' }, popup = { opener: {}, closed: false, document: { write() {}, close() {}, getElementById: () => status }, location: { replace: (url: string) => navigations.push(url) } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: () => popup } });
    t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); });
    const base = `https://openclaw.qa107.claw${port ? ':' + port : ''}`;
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls++; assert.equal(String(url), base + '/__micelclaw__/control-ui/bootstrap'); assert.equal(navigations.length, 0);
      assert.ok(new Headers(init?.headers).get('authorization') === 'Bearer synthetic-discovery-credential');
      assert.equal(init?.credentials, 'include'); assert.equal(String(url).includes('credential'), false);
      return new Response(null, { status: 204 });
    });
    await openOpenclawControlUi(); assert.equal(calls, 1); assert.deepEqual(navigations, [base + '/']); assert.equal(popup.opener, null);
  });
  it('invalid discovered port rejects before any credential-bearing fetch or navigation', async (t) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window'); let calls = 0, navigations = 0;
    const status = { textContent: '' }, popup = { opener: {}, closed: false, document: { write() {}, close() {}, getElementById: () => status }, location: { replace() { navigations++; } } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: () => popup } });
    t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); });
    t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('Unexpected real fetch'); });
    for (const port of [0, 65536, '18666', null]) {
      fixtureDiscovery = { data: { host: 'openclaw.qa107.claw', bootstrap_path: '/__micelclaw__/control-ui/bootstrap', ready: true, https_port: port } };
      await assert.rejects(openOpenclawControlUi());
    }
    assert.equal(calls, 0); assert.equal(navigations, 0);
  });
  it('rejects discovery from a prior identity before bootstrapping another cookie', async (t) => {
    fixtureDiscovery = { data: { host: 'openclaw.qa.claw', bootstrap_path: '/__micelclaw__/control-ui/bootstrap', ready: true } };
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('must not bootstrap'); });
    afterDiscovery = changeFixtureOwner;
    t.after(() => { afterDiscovery = () => {}; });
    await assert.rejects(prepareOpenclawControlUi());
    assert.equal(calls, 0);
  });
  it('rejects successful bootstrap from a prior identity without returning a frame URL', async (t) => {
    fixtureDiscovery = { data: { host: 'openclaw.qa.claw', bootstrap_path: '/__micelclaw__/control-ui/bootstrap', ready: true } };
    t.mock.method(globalThis, 'fetch', async () => { changeFixtureOwner(); return new Response(null, { status: 204 }); });
    await assert.rejects(prepareOpenclawControlUi());
  });
  it('cancels A before preparing B and a delayed A response cannot overwrite the fixture cookie', async (t) => {
    fixtureDiscovery = { data: { host: 'openclaw.qa.claw', bootstrap_path: '/__micelclaw__/control-ui/bootstrap', ready: true } };
    let notifyStarted!: () => void, completeA!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    let calls = 0, cookieOwner: string | null = null;
    t.mock.method(globalThis, 'fetch', async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const owner = fixtureOwner;
      calls++;
      if (calls === 1) return new Promise<Response>((resolve, reject) => {
        const signal = init!.signal!;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        completeA = () => { if (!signal.aborted) { cookieOwner = owner; resolve(new Response(null, { status: 204 })); } };
        notifyStarted();
      });
      cookieOwner = owner;
      return new Response(null, { status: 204 });
    });
    const old = prepareOpenclawControlUi();
    const rejected = assert.rejects(old);
    await started; changeFixtureOwner();
    const current = prepareOpenclawControlUi();
    await rejected; await current;
    completeA();
    assert.equal(cookieOwner, fixtureOwner);
    assert.equal(calls, 2);
    assert.equal(authListeners.size, 0);
  });
});

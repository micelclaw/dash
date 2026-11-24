import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NativeControlUiBridge, NATIVE_HOST_PROTOCOL, type NativeChannelDraft, type NativeChannelWrite, type NativeHostState, type NativeHostNavigation, type NativeHostTarget } from './openclaw-host-bridge.ts';

class FixturePort {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  peer!: FixturePort;
  closed = false;
  start() {}
  postMessage(data: unknown) { queueMicrotask(() => { if (!this.peer.closed) this.peer.onmessage?.({ data }); }); }
  close() { this.closed = true; }
}
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
function fixture(timeoutMs = 1000,
  target: NativeHostTarget = { surface: 'chat', sessionKey: 'agent:fixture:session-a', sessionId: 'session-a' },
  onChannelDraft?: (draft: NativeChannelWrite, signal: AbortSignal) => Promise<unknown>) {
  const origin = 'https://openclaw.qa.claw', digest = 'a'.repeat(64);
  const principal = 'micelclaw:user:11111111-1111-4111-8111-111111111111';
  let listener: ((event: MessageEvent) => void) | null = null, current = true;
  const sent: Array<{ protocol: string; requestId: string; body: Record<string, unknown> }> = [];
  const received: Array<{ requestId: string; body: Record<string, unknown> }> = [];
  const states: NativeHostState[] = [], navigations: NativeHostNavigation[] = [];
  let remote: FixturePort | null = null, channels = 0, reconnects = 0;
  const frame = { postMessage(data: typeof sent[number], targetOrigin: string) { assert.equal(targetOrigin, origin); sent.push(data); } } as unknown as Window;
  const bridge = new NativeControlUiBridge({
    origin, frame, instanceId: 'host-fixture', generation: 2, artifactDigest: digest,
    principal, target, isCurrent: () => current, onState: (state) => states.push(state),
    onNavigate: (navigation) => navigations.push(navigation), timeoutMs,
    onReconnect: () => { reconnects++; },
    onChannelDraft,
    subscribe: (handler) => { listener = handler; return () => { listener = null; }; },
    createChannel: () => {
      channels++;
      const local = new FixturePort(), native = new FixturePort(); local.peer = native; native.peer = local;
      native.onmessage = (event) => received.push(event.data as typeof received[number]);
      remote = native;
      return { port1: local, port2: native } as unknown as MessageChannel;
    },
  });
  function message(requestId: string, body: Record<string, unknown>) {
    return { protocol: NATIVE_HOST_PROTOCOL, instanceId: 'host-fixture', generation: 2, requestId, body };
  }
  function hello(overrides: Record<string, unknown> = {}, eventOverrides: Partial<MessageEvent> = {}) {
    listener?.({ origin, source: frame, data: message(sent[0]!.requestId,
      { kind: 'hello', artifactDigest: digest, principal, recoveryScope: 'native-admitted-scope', ...overrides }), ...eventOverrides } as MessageEvent);
  }
  function native(requestId: string, body: Record<string, unknown>) { assert.ok(remote); remote.postMessage(message(requestId, body)); }
  async function ready() {
    hello(); await tick(); const present = received.at(-1)!;
    native(present.requestId, { kind: 'presented', target: present.body.target }); await tick();
  }
  return { bridge, sent, received, states, navigations, hello, native, ready, target,
    retire: () => { current = false; }, channels: () => channels, subscribed: () => listener !== null,
    reconnects: () => reconnects };
}

it('C02-03 accepts a single client reconnect from the admitted connection target', async (t) => {
  const overview = fixture(1000, { surface: 'connection' });
  const chat = fixture();
  t.after(() => { overview.bridge.dispose(); chat.bridge.dispose(); });
  await overview.ready();
  await chat.ready();
  const id = overview.received.at(-1)!.requestId;
  overview.native('different-request', { kind: 'reconnect-client' });
  overview.native(id, { kind: 'reconnect-client', restart: true });
  chat.native(chat.received.at(-1)!.requestId, { kind: 'reconnect-client' });
  await tick();
  assert.equal(overview.reconnects(), 0);
  assert.equal(chat.reconnects(), 0);
  overview.native(id, { kind: 'reconnect-client' });
  overview.native(id, { kind: 'reconnect-client' });
  await tick();
  assert.equal(overview.reconnects(), 1);
});

it('C02-04 dispatches only one scoped draft from the current Channels presentation', async (t) => {
  const received: NativeChannelWrite[] = [];
  const result = { config: {}, hash: 'native-hash' };
  const f = fixture(1000, { surface: 'channels' }, async draft => { received.push(draft); return result; });
  t.after(() => f.bridge.dispose());
  await f.ready();
  const presentationId = f.received.at(-1)!.requestId;
  const draft: NativeChannelDraft = { channelId: 'telegram', accountId: 'team', method: 'config.set',
    raw: '{"channels":{"telegram":{"accounts":{"team":{"historyLimit":25}}}}}', baseHash: 'hmac-sha256:v1:fixture' };
  f.native('wrong-presentation', { kind: 'channel-draft', presentationId: 'older-presentation', draft });
  f.native('same-write', { kind: 'channel-draft', presentationId, draft });
  f.native('same-write', { kind: 'channel-draft', presentationId, draft });
  await tick();
  await tick();
  assert.deepEqual(received, [draft]);
  assert.deepEqual(f.received.find(message => message.requestId === 'same-write')?.body,
    { kind: 'channel-draft-receipt', receipt: result });
});

it('admits only the bounded wizard confirmation for the current channels presentation', async (t) => {
  const received: NativeChannelWrite[] = [];
  const f = fixture(1000, { surface: 'channels' }, async draft => { received.push(draft); return { done: true }; });
  t.after(() => f.bridge.dispose());
  await f.ready();
  const presentationId = f.received.at(-1)!.requestId;
  const draft = { method: 'wizard.confirm', channelId: 'telegram', accountId: 'qa',
    baseHash: 'a'.repeat(64), sessionId: 'session', stepId: 'step' };
  f.native('invalid', { kind: 'channel-draft', presentationId, draft: { ...draft, raw: '{}' } });
  f.native('foreign', { kind: 'channel-draft', presentationId: 'older-presentation', draft });
  f.native('confirmation', { kind: 'channel-draft', presentationId, draft });
  f.native('confirmation', { kind: 'channel-draft', presentationId, draft });
  await tick();
  await tick();
  assert.deepEqual(received, [draft]);
  assert.deepEqual(f.received.find(message => message.requestId === 'confirmation')?.body,
    { kind: 'channel-draft-receipt', receipt: { done: true } });
});

describe('C07 native presentation bridge (message fixtures, no native runtime)', () => {
  it('opens Voice settings only for the currently presented native Chat', async (t) => {
    const chat = fixture();
    const channels = fixture(1000, { surface: 'channels' });
    t.after(() => { chat.bridge.dispose(); channels.bridge.dispose(); });
    await chat.ready();
    await channels.ready();
    const body = { kind: 'navigate', navigation: { kind: 'voice-settings', section: 'microphone' } };
    chat.native('older-presentation', body);
    channels.native(channels.received.at(-1)!.requestId, body);
    await tick();
    assert.deepEqual(chat.navigations, []);
    assert.deepEqual(channels.navigations, []);
    chat.native(chat.received.at(-1)!.requestId, body);
    await tick();
    assert.deepEqual(chat.navigations, [body.navigation]);
  });
  it('retries the same handshake while the native module is still loading and stops after admission', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
    const f = fixture(); t.after(() => f.bridge.dispose());
    t.mock.timers.tick(400);
    assert.deepEqual(f.sent, [f.sent[0], f.sent[0]]);
    await f.ready();
    t.mock.timers.tick(800);
    assert.deepEqual(f.sent.map((message) => message.body.kind), ['connect', 'connect', 'bind']);
  });
  it('requires exact origin/source and admitted identity before binding; iframe load is not ready', async (t) => {
    const f = fixture(); t.after(() => f.bridge.dispose());
    f.hello({}, { origin: 'https://openclaw.qa.claw.attacker.test' });
    f.hello({}, { source: {} as Window });
    f.hello({}, { data: { kind: 'load' } });
    assert.equal(f.channels(), 0); assert.deepEqual(f.states, ['connecting']);
    f.hello(); await tick();
    assert.equal(f.channels(), 1); assert.equal(f.states.includes('ready'), false);
    const request = f.received.at(-1)!;
    f.native(request.requestId, { kind: 'presented', target: { ...f.target, sessionId: 'different-session' } }); await tick();
    assert.equal(f.states.includes('ready'), false);
    f.native(request.requestId, { kind: 'presented', target: request.body.target }); await tick();
    assert.equal(f.states.at(-1), 'ready');
  });
  it('rejects an incompatible artifact or a different principal and cannot resurrect from hello', (t) => {
    const version = fixture(); t.after(() => version.bridge.dispose());
    version.hello({ artifactDigest: 'b'.repeat(64) }); version.hello();
    assert.equal(version.states.at(-1), 'version-mismatch'); assert.equal(version.channels(), 0);
    const identity = fixture(); t.after(() => identity.bridge.dispose());
    identity.hello({ principal: 'micelclaw:user:22222222-2222-4222-8222-222222222222' });
    assert.equal(identity.states.at(-1), 'unauthorized'); assert.equal(identity.channels(), 0);
  });
  it('ignores old target acknowledgements and reuses the same channel for a new surface', async (t) => {
    const f = fixture(); t.after(() => f.bridge.dispose());
    f.hello(); await tick(); const old = f.received.at(-1)!;
    f.bridge.present({ surface: 'channels' }); await tick(); const next = f.received.at(-1)!;
    f.native(old.requestId, { kind: 'presented', target: old.body.target }); await tick();
    assert.equal(f.states.includes('ready'), false);
    f.native(next.requestId, { kind: 'presented', target: next.body.target }); await tick();
    assert.equal(f.states.at(-1), 'ready');
    const count = f.received.length;
    f.bridge.present({ surface: 'channels' }); await tick();
    assert.equal(f.received.length, count); assert.equal(f.channels(), 1);
  });
  it('ignores an error from A while presenting B, but retains global connection revocation', async (t) => {
    const f = fixture(); t.after(() => f.bridge.dispose());
    f.hello(); await tick(); const old = f.received.at(-1)!;
    f.bridge.present({ surface: 'devices' }); await tick(); const next = f.received.at(-1)!;
    f.native(old.requestId, { kind: 'unavailable', reason: 'unauthorized' }); await tick();
    assert.equal(f.states.at(-1), 'connecting');
    f.native(next.requestId, { kind: 'presented', target: next.body.target }); await tick();
    assert.equal(f.states.at(-1), 'ready');
    f.native(f.sent[0]!.requestId, { kind: 'connection-unavailable', reason: 'unauthorized' }); await tick();
    assert.equal(f.states.at(-1), 'unauthorized');
  });
  it('accepts typed module navigation but never arbitrary RPC, URL or shell instructions', async (t) => {
    const f = fixture(); t.after(() => f.bridge.dispose()); await f.ready();
    f.native('native-nav-1', { kind: 'navigate', navigation: { kind: 'entity', entityType: 'note', entityId: 'fixture-note', newTab: true } });
    f.native('native-nav-2', { kind: 'navigate', navigation: { kind: 'url', url: 'https://other.test' } });
    f.native('native-rpc', { kind: 'request', method: 'config.set', params: {} });
    f.native('native-shell', { kind: 'shell', command: 'arbitrary' });
    await tick();
    assert.deepEqual(f.navigations, [{ kind: 'entity', entityType: 'note', entityId: 'fixture-note', newTab: true }]);
    assert.equal(f.received.filter((message) => message.body.kind === 'present').length, 1);
  });
  it('disposes immediately on a retired authentication generation and ignores queued navigation', async (t) => {
    const f = fixture(); t.after(() => f.bridge.dispose()); await f.ready();
    f.retire();
    f.native('late', { kind: 'navigate', navigation: { kind: 'voice-settings', section: 'microphone' } }); await tick();
    assert.equal(f.states.at(-1), 'disposed'); assert.equal(f.navigations.length, 0); assert.equal(f.subscribed(), false);
    f.bridge.present(f.target); assert.equal(f.states.at(-1), 'disposed');
  });
  it('times out instead of treating an absent native runtime as connected', async (t) => {
    const f = fixture(1); t.after(() => f.bridge.dispose());
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(f.states.at(-1), 'retryable-unavailable'); assert.equal(f.subscribed(), false);
  });
});

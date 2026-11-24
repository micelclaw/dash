/** Bounded presentation bridge. It never exposes Gateway RPC or Dash credentials. */
export const NATIVE_HOST_PROTOCOL = 'micelclaw.control-ui/v1';
export const NATIVE_HOST_ADAPTER_DIGEST = '9ce6d811200d6101638b768f1a5ec6aad2450a396bec859cfe903ba22db54508';
export type NativeHostState = 'connecting' | 'ready' | 'unauthorized' | 'retryable-unavailable' | 'version-mismatch' | 'disposed';
export type NativeHostTarget =
  | { surface: 'chat'; sessionKey: string; sessionId: string }
  | { surface: 'connection' | 'sessions' | 'automations' | 'channels' | 'devices' | 'usage' };
export type NativeHostNavigation =
  | { kind: 'entity'; entityType: string; entityId: string; newTab: boolean }
  | { kind: 'micelhub'; tab: 'plugins' | 'apps'; focus?: string }
  | { kind: 'voice-settings'; section: 'providers' | 'microphone' };
export type NativeChannelDraft = {
  channelId: string;
  accountId?: string;
  method: 'config.set' | 'config.patch' | 'config.apply' | 'channel.disable';
  raw: string;
  baseHash: string;
  replacePaths?: string[];
};
export type NativeChannelWizardConfirmation = {
  method: 'wizard.confirm';
  channelId: string;
  accountId: string;
  baseHash: string;
  sessionId: string;
  stepId: string;
};
export type NativeChannelWrite = NativeChannelDraft | NativeChannelWizardConfirmation;
type Envelope = { protocol: string; instanceId: string; generation: number; requestId: string; body: Record<string, unknown> };
type Options = {
  origin: string; frame: Window; instanceId: string; generation: number;
  artifactDigest: string; principal: string; target: NativeHostTarget;
  isCurrent: () => boolean;
  subscribe: (listener: (event: MessageEvent) => void) => () => void;
  onState: (state: NativeHostState) => void;
  onNavigate: (navigation: NativeHostNavigation) => void;
  onReconnect?: () => void;
  onChannelDraft?: (draft: NativeChannelWrite, signal: AbortSignal) => Promise<unknown>;
  createChannel?: () => MessageChannel;
  timeoutMs?: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(value).every((key) => allowed.includes(key)); }
function validTarget(value: NativeHostTarget): boolean {
  if (!record(value)) return false;
  return value.surface === 'chat'
    ? keys(value, ['surface', 'sessionKey', 'sessionId']) && text(value.sessionKey) && text(value.sessionId, 128)
    : keys(value, ['surface']) && ['connection', 'sessions', 'automations', 'channels', 'devices', 'usage'].includes(value.surface);
}
function sameTarget(a: Record<string, unknown>, b: NativeHostTarget): boolean {
  return validTarget(a as NativeHostTarget) && a.surface === b.surface
    && (b.surface !== 'chat' || (a.sessionKey === b.sessionKey && a.sessionId === b.sessionId));
}
function validChannelDraft(value: unknown): value is NativeChannelDraft {
  return record(value) && keys(value, ['channelId', 'accountId', 'method', 'raw', 'baseHash', 'replacePaths'])
    && typeof value.channelId === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value.channelId)
    && (value.accountId === undefined || typeof value.accountId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value.accountId))
    && (value.method === 'config.set' || value.method === 'config.patch' || value.method === 'config.apply' || value.method === 'channel.disable')
    && typeof value.raw === 'string' && value.raw.length > 1 && value.raw.length <= 512 * 1024
    && typeof value.baseHash === 'string' && /^[\x21-\x7e]{1,256}$/.test(value.baseHash)
    && (value.replacePaths === undefined || Array.isArray(value.replacePaths) && value.replacePaths.length <= 256 &&
      value.replacePaths.every(path => text(path, 512)));
}
function validWizardConfirmation(value: unknown): value is NativeChannelWizardConfirmation {
  const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
  return record(value) && keys(value, ['method', 'channelId', 'accountId', 'baseHash', 'sessionId', 'stepId'])
    && value.method === 'wizard.confirm'
    && typeof value.channelId === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value.channelId)
    && [value.accountId, value.sessionId, value.stepId].every(id => typeof id === 'string' && identifier.test(id))
    && typeof value.baseHash === 'string' && /^[a-f0-9]{64}$/.test(value.baseHash);
}

export class NativeControlUiBridge {
  private port: MessagePort | null = null;
  private state: NativeHostState = 'connecting';
  private unsubscribe: () => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private pending: { requestId: string; target: NativeHostTarget } | null = null;
  private presentedRequestId: string | null = null;
  private channelWrite: AbortController | null = null;
  private channelWriteIds = new Set<string>();
  private connectId: string;

  constructor(private readonly options: Options) {
    const origin = new URL(options.origin);
    if (origin.protocol !== 'https:' || origin.origin !== options.origin
      || !/^[a-f0-9]{64}$/.test(options.artifactDigest)
      || !/^micelclaw:user:[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(options.principal)
      || !text(options.instanceId, 128) || !Number.isSafeInteger(options.generation) || options.generation < 0
      || !validTarget(options.target)) throw new Error('NATIVE_HOST_CONTEXT_INVALID');
    this.connectId = this.requestId();
    this.unsubscribe = options.subscribe((event) => this.acceptHello(event));
    this.setState('connecting');
    this.armTimeout();
    // A lazy native module can register its listener after the iframe load event.
    this.connectTimer = setInterval(() => this.sendConnect(), 400);
    this.sendConnect();
  }

  private requestId(): string { return `${this.options.instanceId}:${++this.sequence}`; }
  private envelope(requestId: string, body: Record<string, unknown>): Envelope {
    return { protocol: NATIVE_HOST_PROTOCOL, instanceId: this.options.instanceId, generation: this.options.generation, requestId, body };
  }
  private current(): boolean {
    if (this.state !== 'connecting' && this.state !== 'ready') return false;
    if (!this.options.isCurrent()) { this.dispose(); return false; }
    return true;
  }
  private parse(value: unknown): Envelope | null {
    if (!record(value) || !keys(value, ['protocol', 'instanceId', 'generation', 'requestId', 'body'])
      || value.protocol !== NATIVE_HOST_PROTOCOL || value.instanceId !== this.options.instanceId
      || value.generation !== this.options.generation || !text(value.requestId, 256) || !record(value.body)) return null;
    const max = this.options.target.surface === 'channels' && value.body.kind === 'channel-draft' ? 540 * 1024 : 64 * 1024;
    try { if (JSON.stringify(value).length > max) return null; } catch { return null; }
    return value as Envelope;
  }
  private setState(state: NativeHostState): void { this.state = state; this.options.onState(state); }
  private sendConnect(): void {
    if (!this.current()) return;
    try { this.options.frame.postMessage(this.envelope(this.connectId, { kind: 'connect' }), this.options.origin); }
    catch { this.fail('retryable-unavailable'); }
  }
  private stopConnect(): void {
    if (this.connectTimer) clearInterval(this.connectTimer);
    this.connectTimer = null;
  }
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private armTimeout(): void {
    this.clearTimer();
    this.timer = setTimeout(() => { if (this.current()) this.fail('retryable-unavailable'); }, this.options.timeoutMs ?? 15_000);
  }
  private fail(state: 'unauthorized' | 'version-mismatch' | 'retryable-unavailable'): void {
    this.clearTimer(); this.stopConnect(); this.pending = null;
    this.port?.close(); this.port = null; this.unsubscribe();
    this.channelWrite?.abort();
    this.setState(state);
  }
  private acceptHello(event: MessageEvent): void {
    if (!this.current() || this.port || event.origin !== this.options.origin || event.source !== this.options.frame || event.ports?.length) return;
    const message = this.parse(event.data);
    if (!message || message.requestId !== this.connectId || message.body.kind !== 'hello'
      || !keys(message.body, ['kind', 'artifactDigest', 'principal', 'recoveryScope'])) return;
    if (message.body.artifactDigest !== this.options.artifactDigest) { this.fail('version-mismatch'); return; }
    // These fields must originate from an admitted native hello/recovery scope.
    // A parent-supplied userId must never stand in for Gateway admission.
    if (message.body.principal !== this.options.principal || !text(message.body.recoveryScope)) { this.fail('unauthorized'); return; }
    this.stopConnect();
    const channel = (this.options.createChannel ?? (() => new MessageChannel()))();
    this.port = channel.port1;
    this.port.onmessage = (received) => this.acceptPortMessage(received.data);
    this.port.onmessageerror = () => { if (this.current()) this.fail('retryable-unavailable'); };
    this.port.start();
    try {
      this.options.frame.postMessage(this.envelope(this.connectId, { kind: 'bind' }), this.options.origin, [channel.port2]);
      this.present(this.options.target);
    } catch { channel.port2.close(); this.fail('retryable-unavailable'); }
  }
  private acceptPortMessage(value: unknown): void {
    if (!this.current() || !this.port) return;
    const message = this.parse(value);
    if (!message) return;
    const body = message.body;
    if (body.kind === 'presented' && keys(body, ['kind', 'target']) && record(body.target)
      && this.pending?.requestId === message.requestId && sameTarget(body.target, this.pending.target)) {
      this.presentedRequestId = message.requestId;
      this.pending = null; this.clearTimer(); this.setState('ready'); return;
    }
    const presentationError = body.kind === 'unavailable'
      && message.requestId === (this.pending?.requestId ?? this.presentedRequestId);
    const connectionError = body.kind === 'connection-unavailable' && message.requestId === this.connectId;
    if ((presentationError || connectionError) && keys(body, ['kind', 'reason'])
      && ['unauthorized', 'retryable-unavailable', 'version-mismatch'].includes(String(body.reason))) {
      this.fail(body.reason as 'unauthorized' | 'retryable-unavailable' | 'version-mismatch'); return;
    }
    if (this.state === 'ready' && this.options.target.surface === 'connection'
      && message.requestId === this.presentedRequestId && body.kind === 'reconnect-client' && keys(body, ['kind'])) {
      this.presentedRequestId = null;
      this.options.onReconnect?.();
      return;
    }
    if (this.state === 'ready' && this.options.target.surface === 'channels'
      && this.presentedRequestId && body.kind === 'channel-draft'
      && keys(body, ['kind', 'presentationId', 'draft']) && body.presentationId === this.presentedRequestId
      && (validChannelDraft(body.draft) || validWizardConfirmation(body.draft)) && this.options.onChannelDraft
      && !this.channelWrite && !this.channelWriteIds.has(message.requestId) && this.channelWriteIds.size < 2048) {
      this.channelWriteIds.add(message.requestId);
      const controller = new AbortController();
      this.channelWrite = controller;
      const send = (result: Record<string, unknown>) => {
        if (!controller.signal.aborted && this.current() && this.presentedRequestId === body.presentationId) {
          this.port?.postMessage(this.envelope(message.requestId, result));
        }
      };
      void this.options.onChannelDraft(body.draft, controller.signal)
        .then(receipt => send({ kind: 'channel-draft-receipt', receipt }), (error: { status?: number; code?: string }) => {
          const code = error?.code;
          send({ kind: 'channel-draft-error', status: error?.status ?? 503,
            ...((code === 'NATIVE_CHANNEL_PENDING_OUTSIDE_SCOPE' || code === 'NATIVE_CHANNEL_ALREADY_DISABLED') && { code }) });
        })
        .finally(() => { if (this.channelWrite === controller) this.channelWrite = null; });
      return;
    }
    if (this.state !== 'ready' || body.kind !== 'navigate' || !keys(body, ['kind', 'navigation'])) return;
    const navigation = body.navigation;
    if (!record(navigation)) return;
    if (navigation.kind === 'entity' && keys(navigation, ['kind', 'entityType', 'entityId', 'newTab'])
      && text(navigation.entityType, 128) && /^[a-z][a-z0-9_-]*$/.test(navigation.entityType)
      && text(navigation.entityId, 256) && typeof navigation.newTab === 'boolean') {
      this.options.onNavigate(navigation as NativeHostNavigation);
    } else if (navigation.kind === 'micelhub' && keys(navigation, ['kind', 'tab', 'focus'])
      && ['plugins', 'apps'].includes(String(navigation.tab)) && (navigation.focus === undefined || text(navigation.focus, 256))) {
      this.options.onNavigate(navigation as NativeHostNavigation);
    } else if (navigation.kind === 'voice-settings' && this.options.target.surface === 'chat'
      && message.requestId === this.presentedRequestId && keys(navigation, ['kind', 'section'])
      && ['providers', 'microphone'].includes(String(navigation.section))) this.options.onNavigate(navigation as NativeHostNavigation);
  }

  present(target: NativeHostTarget): void {
    if (!validTarget(target)) throw new Error('NATIVE_HOST_TARGET_INVALID');
    if (!this.current()) return;
    if ((this.state === 'ready' && sameTarget(target, this.options.target))
      || (this.pending && sameTarget(target, this.pending.target))) return;
    this.channelWrite?.abort();
    this.options.target = target;
    if (!this.port) return;
    const requestId = this.requestId();
    this.pending = { requestId, target }; this.setState('connecting'); this.armTimeout();
    this.port.postMessage(this.envelope(requestId, { kind: 'present', target }));
  }
  dispose(): void {
    if (this.state === 'disposed') return;
    this.clearTimer(); this.stopConnect(); this.unsubscribe();
    this.channelWrite?.abort();
    this.port?.postMessage(this.envelope(this.requestId(), { kind: 'dispose' }));
    this.port?.close(); this.port = null; this.pending = null; this.presentedRequestId = null;
    this.setState('disposed');
  }
}

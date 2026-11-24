import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { prepareOpenclawControlUi } from '@/services/openclaw-control-ui.service';
import { NativeControlUiBridge, type NativeChannelWrite, type NativeHostNavigation, type NativeHostState, type NativeHostTarget } from '@/services/openclaw-host-bridge';
import { Button } from '@/components/ui/button';

type Props = {
  /** Compatibility marker of the adapter for the pinned release. */
  artifactDigest: string;
  title?: string;
  resolveTarget: (signal: AbortSignal) => Promise<NativeHostTarget>;
  onNavigate?: (navigation: NativeHostNavigation) => void;
  onChannelDraft?: (draft: NativeChannelWrite, signal: AbortSignal) => Promise<unknown>;
};
type State = NativeHostState | 'bootstrapping' | 'missing-conversation';
const labels: Record<State, string> = {
  bootstrapping: 'Preparando tu sesión personal…', connecting: 'Conectando con la conversación…',
  'missing-conversation': 'La conversación no tiene una sesión nativa disponible para ti.',
  ready: '', unauthorized: 'El acceso a esta sesión ha caducado o ha sido retirado.',
  'retryable-unavailable': 'No se pudo conectar con la interfaz nativa. Puedes volver a intentarlo.',
  'version-mismatch': 'La interfaz y el servicio necesitan la misma actualización.', disposed: 'La sesión se ha cerrado.',
};

/** One trusted native document. Untrusted MCP/Canvas resources retain their own isolation. */
export function NativeOpenclawHost({ artifactDigest, title, resolveTarget, onNavigate, onChannelDraft }: Props) {
  const owner = useAuthStore((store) => store.user?.id);
  const generation = useAuthStore((store) => store.sessionGeneration);
  const logoutState = useAuthStore((store) => store.logoutState);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  // Replacing the owner retires the entire document synchronously, before effects.
  if (!owner || logoutState !== 'idle') return null;
  return <NativeHostDocument key={`${owner}:${generation}:${artifactDigest}:${attempt}`} owner={owner}
    generation={generation} artifactDigest={artifactDigest} title={title} resolveTarget={resolveTarget} onNavigate={onNavigate} onChannelDraft={onChannelDraft}
    onRetry={retry} />;
}

function NativeHostDocument({ owner, generation, artifactDigest, title, resolveTarget, onNavigate, onChannelDraft, onRetry }: Props & { owner: string; generation: number; onRetry: () => void }) {
  const [state, setState] = useState<State>('bootstrapping');
  const [document, setDocument] = useState<{ url: string; origin: string; target: NativeHostTarget } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<NativeControlUiBridge | null>(null);
  const documentRetired = useRef(false);
  const loadDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLoadDeadline = useCallback(() => {
    if (loadDeadline.current) clearTimeout(loadDeadline.current);
    loadDeadline.current = null;
  }, []);
  const navigate = useRef(onNavigate);
  useEffect(() => { navigate.current = onNavigate; }, [onNavigate]);
  const isCurrent = useCallback(() => {
    const auth = useAuthStore.getState();
    return auth.user?.id === owner && auth.sessionGeneration === generation && auth.logoutState === 'idle';
  }, [owner, generation]);

  useEffect(() => {
    documentRetired.current = false;
    const abort = new AbortController();
    const unsubscribe = useAuthStore.subscribe(() => {
      if (!isCurrent()) { documentRetired.current = true; abort.abort(); clearLoadDeadline(); bridge.current?.dispose(); setDocument(null); }
    });
    void prepareOpenclawControlUi({ signal: abort.signal, isClosed: () => !isCurrent() }).then(async ({ origin, homeUrl }) => {
      // The personal bootstrap provisions the Gateway profile on its first use.
      // Check the conversation with that identity before navigating the iframe.
      if (abort.signal.aborted || !isCurrent()) return;
      const target = await resolveTarget(abort.signal);
      if (abort.signal.aborted || !isCurrent()) return;
      const url = new URL(homeUrl);
      url.searchParams.set('micelclawEmbed', '1');
      if (target.surface !== 'chat') {
        const theme = window.document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        url.searchParams.set('micelclawTheme', theme);
      }
      // iframe.load itself may never arrive. Cover navigation before starting
      // the bridge's separate admitted-runtime/target deadline.
      loadDeadline.current = setTimeout(() => {
        if (!abort.signal.aborted && isCurrent()) {
          documentRetired.current = true; bridge.current?.dispose(); setDocument(null); setState('retryable-unavailable');
        }
      }, 15_000);
      setDocument({ url: url.href, origin, target }); setState('connecting');
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !isCurrent()) return;
      documentRetired.current = true;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) setState('unauthorized');
      else if (status === 404 || status === 409) setState('missing-conversation');
      else setState('retryable-unavailable');
    });
    return () => { documentRetired.current = true; unsubscribe(); abort.abort(); clearLoadDeadline(); bridge.current?.dispose(); bridge.current = null; };
  }, [isCurrent, clearLoadDeadline, resolveTarget]);

  const connect = useCallback(() => {
    clearLoadDeadline();
    bridge.current?.dispose(); bridge.current = null;
    const nativeWindow = frame.current?.contentWindow;
    if (!document || !nativeWindow || !isCurrent() || documentRetired.current) return;
    try {
      bridge.current = new NativeControlUiBridge({
        origin: document.origin, frame: nativeWindow, instanceId: crypto.randomUUID(), generation,
        artifactDigest, principal: `micelclaw:user:${owner}`, target: document.target,
        isCurrent, onState: (next) => {
          if (next === 'unauthorized' || next === 'version-mismatch' || next === 'retryable-unavailable') documentRetired.current = true;
          setState(next);
        }, onNavigate: (intent) => navigate.current?.(intent), onReconnect: onRetry, onChannelDraft,
        subscribe: (listener) => { window.addEventListener('message', listener); return () => window.removeEventListener('message', listener); },
      });
    } catch { setState('version-mismatch'); }
  }, [document, isCurrent, artifactDigest, generation, owner, clearLoadDeadline, onRetry, onChannelDraft]);

  const failure = state !== 'bootstrapping' && state !== 'connecting' && state !== 'ready';
  return <section aria-label={title ?? 'Conversación nativa'} aria-busy={state === 'bootstrapping' || state === 'connecting'} className="relative flex h-full min-h-0 flex-col">
    {state !== 'ready' && <div role={failure ? 'alert' : 'status'} className="flex flex-col items-center gap-3 p-6 text-sm text-muted-foreground">
      <p>{title && state === 'connecting' ? 'Conectando con Gateway…'
        : title && state === 'missing-conversation' ? labels['retryable-unavailable'] : labels[state]}</p>
      {failure && <Button variant="outline" onClick={onRetry}>Volver a conectar</Button>}
    </div>}
    {document && !failure && <iframe ref={frame} src={document.url} onLoad={connect} title={title ?? 'Chat y paneles de OpenClaw'}
      className={`min-h-0 w-full flex-1 border-0 ${state === 'ready' ? '' : 'invisible'}`}
      referrerPolicy="no-referrer"
      allow={document.target.surface === 'chat'
        ? `microphone ${document.origin}; camera ${document.origin}; clipboard-read ${document.origin}; clipboard-write ${document.origin}`
        : `clipboard-write ${document.origin}`} />}
  </section>;
}

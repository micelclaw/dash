type ControlUiDiscovery = { data: { host: string; bootstrap_path: string; ready: boolean } };
// The 9.4 Gateway can take 4–5 minutes to apply an identity roster change.
// Leave margin for its second automatic reload without retrying forever.
const BOOTSTRAP_WAIT_MS = 8 * 60_000;
const MAX_NETWORK_FAILURES = 3;

function controlUiUrl(host: string, path: string): string {
  return `https://${host}${path}`;
}

function retryableBootstrapStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function bootstrapControlUi(
  url: string,
  getToken: () => string | null | undefined,
  ApiErrorType: typeof import('./api').ApiError,
  options: {
    fetcher?: typeof fetch;
    wait?: (ms: number) => Promise<void>;
    now?: () => number;
    isClosed?: () => boolean;
    maxWaitMs?: number;
    onProgress?: (message: string) => void;
  } = {},
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadline = now() + (options.maxWaitMs ?? BOOTSTRAP_WAIT_MS);
  let networkFailures = 0;
  while (true) {
    if (options.isClosed?.()) throw new ApiErrorType('OPENCLAW_CONTROL_UI_CLOSED', 'Se cerró la pestaña de Control UI.');
    const token = getToken();
    if (!token) throw new ApiErrorType('OPENCLAW_CONTROL_UI_UNAVAILABLE', 'Vuelve a iniciar sesión en Micelclaw antes de abrir la Control UI.');
    let response: Response | undefined;
    try {
      response = await fetcher(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // A single network error can happen during an automatic proxy reload.
      // Repeated errors are usually DNS/TLS/CORS/Brave blocking the request;
      // waiting eight minutes in an about:blank tab cannot fix those cases.
      networkFailures++;
      if (networkFailures >= MAX_NETWORK_FAILURES) {
        throw new ApiErrorType(
          'OPENCLAW_CONTROL_UI_NETWORK',
          'El navegador no puede conectar con openclaw.victor.claw. Comprueba el dominio y el certificado de Control UI.',
        );
      }
      options.onProgress?.(`Reconectando con Control UI (${networkFailures}/${MAX_NETWORK_FAILURES})…`);
    }
    if (response) networkFailures = 0;
    if (response?.ok) return;
    if (response && !retryableBootstrapStatus(response.status)) {
      throw new ApiErrorType(
        'OPENCLAW_CONTROL_UI_BOOTSTRAP_FAILED',
        response.status === 401 || response.status === 403
          ? 'Tu sesión personal de Control UI no está autorizada. Vuelve a iniciar sesión en Micelclaw.'
          : `No se pudo preparar tu sesión personal de Control UI (HTTP ${response.status}).`,
        undefined,
        response.status,
      );
    }
    if (now() >= deadline) {
      throw new ApiErrorType('OPENCLAW_CONTROL_UI_GATEWAY_TIMEOUT', 'OpenClaw no ha terminado de iniciar. Comprueba el Gateway y vuelve a intentarlo.');
    }
    const retryAfterSeconds = Number(response?.headers.get('retry-after'));
    if (response) options.onProgress?.('OpenClaw está preparando tu sesión. Reintentando…');
    const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(10_000, Math.max(1_000, retryAfterSeconds * 1_000))
      : 3_000;
    await wait(Math.min(delay, Math.max(0, deadline - now())));
  }
}

function showPopupStatus(popup: Window, message: string): void {
  try {
    const status = popup.document.getElementById('control-ui-status');
    if (status) status.textContent = message;
  } catch { /* The tab may have been closed by the user. */ }
}

/**
 * Gives the dedicated Control UI host a host-only Micelclaw session cookie,
 * then navigates a separate tab. The bearer is sent only to Core's authenticated
 * bootstrap endpoint and never appears in a URL or reaches OpenClaw.
 */
export async function openOpenclawControlUi(): Promise<void> {
  // This must happen before the dynamic imports and the network request.  If
  // it happens after an await, Safari and strict popup blockers no longer
  // consider the call a direct user gesture.
  // Keep a reference long enough to bootstrap the host-only session, then
  // explicitly sever opener below. Some browsers return null immediately when
  // `noopener` is passed as a window feature, which makes a valid popup look
  // blocked and prevents the bootstrap navigation.
  const popup = window.open('', '_blank');
  if (!popup) {
    throw new Error('El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para abrir la Control UI.');
  }
  popup.opener = null;
  popup.document.write('<!doctype html><meta name="referrer" content="no-referrer"><title>Micelclaw · Control UI</title><body><main style="font:16px system-ui;max-width:36rem;margin:12vh auto;padding:2rem"><h1>Control UI</h1><p id="control-ui-status">Preparando tu sesión personal…</p></main></body>');
  popup.document.close();

  try {
    const [{ api, ApiError }, { useAuthStore }] = await Promise.all([
      import('./api'),
      import('../stores/auth.store'),
    ]);
    const discovery = await api.post<ControlUiDiscovery>('/auth/openclaw-control-ui');
    const { host, bootstrap_path: bootstrapPath, ready } = discovery.data;
    if (!ready) throw new ApiError('OPENCLAW_CONTROL_UI_UNAVAILABLE', 'La Control UI todavía no está disponible.');
    await bootstrapControlUi(
      controlUiUrl(host, bootstrapPath),
      () => useAuthStore.getState().tokens?.accessToken,
      ApiError,
      { isClosed: () => popup.closed, onProgress: (message) => showPopupStatus(popup, message) },
    );
    showPopupStatus(popup, 'Abriendo Control UI…');
    popup.location.replace(controlUiUrl(host, '/'));
  } catch (error) {
    showPopupStatus(popup, error instanceof Error ? error.message : 'No se pudo abrir Control UI.');
    throw error;
  }
}

export const __test__ = { bootstrapControlUi, controlUiUrl, retryableBootstrapStatus };

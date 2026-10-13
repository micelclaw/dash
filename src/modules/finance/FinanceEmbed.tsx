/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Finance Embed (iframe vía mini-proxy) ───────────────────────────
// Embebe Firefly III / SolidInvoice en un iframe a viewport completo. Ambas
// apps (Laravel/Symfony) ponen X-Frame-Options y construyen URLs absolutas, así
// que NO se pueden iframear directamente ni bajo un subpath. Cada una tiene un
// MINI-PROXY dedicado en Core (services/embed-proxy.ts) sobre un puerto libre
// (127.0.0.1:8190 firefly / 8191 solidinvoice) que strippea X-Frame-Options +
// CSP frame-ancestors y presenta la app en el origen del proxy. El iframe carga
// `http://127.0.0.1:<puerto>` (127.0.0.1 = origen trustworthy → sin mixed-content
// desde el dash HTTPS). El embed_url lo da GET /finance/:app/embed (que además
// asegura que el proxy esté levantado). La primera vez cada app muestra su
// asistente (Firefly: registro; SolidInvoice: /install) — el usuario lo hace una
// vez. Patrón gemelo de DatabasesFrame (Mathesar).

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Loader2, Download, Minimize2, Copy, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';

interface FinanceAppStatus {
  name: string;
  installed: boolean;
  running: boolean;
  url: string | null;
  embed_url: string | null;
  database: string;
  ram_mb: number | null;
}

interface FinanceSuiteStatus {
  mariadb: { installed: boolean; running: boolean; ram_mb: number | null };
  apps: FinanceAppStatus[];
}

interface EmbedInfo {
  app: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  embed_url: string | null;
}

interface InstallResult {
  success: boolean;
  app: string;
  url: string;
  credentials: { admin_email: string; admin_password: string } | null;
  error: string | null;
}

type Phase = 'loading' | 'not-installed' | 'installing' | 'starting' | 'ready' | 'error';

const CONTAINER_MAP: Record<string, string> = {
  firefly: 'docker:claw-firefly',
  solidinvoice: 'docker:claw-solidinvoice',
};

interface FinanceEmbedProps {
  serviceName: 'firefly' | 'solidinvoice';
  displayName: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}

export function FinanceEmbed({ serviceName, displayName, icon: Icon, color }: FinanceEmbedProps) {
  const navigate = useNavigate();
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  const [phase, setPhase] = useState<Phase>('loading');
  const [appStatus, setAppStatus] = useState<FinanceAppStatus | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<InstallResult['credentials']>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [startupLogs, setStartupLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ─── Poll container logs during install/start ──────────────────
  const seenLogsRef = useRef(new Set<string>());
  useEffect(() => {
    if (phase !== 'installing' && phase !== 'starting') return;
    seenLogsRef.current.clear();
    setStartupLogs([]);

    const processId = CONTAINER_MAP[serviceName];
    const poll = async () => {
      try {
        const res = await api.get<{ data: { lines: string[] } }>(
          `/hal/processes/${encodeURIComponent(processId ?? '')}/logs?tail=20&since=10s`,
        );
        const lines = res.data?.lines ?? [];
        const fresh = lines.filter((l) => !seenLogsRef.current.has(l));
        if (fresh.length) {
          for (const l of fresh) seenLogsRef.current.add(l);
          setStartupLogs((prev) => [...prev, ...fresh].slice(-100));
        }
      } catch { /* container may not exist yet */ }
    };

    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, [phase, serviceName]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [startupLogs]);

  const checkStatus = useCallback(async () => {
    try {
      const envelope = await api.get<{ data: FinanceSuiteStatus }>('/finance/status');
      const app = envelope.data.apps.find((a) => a.name === serviceName);
      if (app) setAppStatus(app);
      return app ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setPhase('error');
      return null;
    }
  }, [serviceName]);

  // Ensure the embed proxy is up + grab the iframe URL.
  const ensureEmbed = useCallback(async () => {
    try {
      const envelope = await api.get<{ data: EmbedInfo }>(`/finance/${serviceName}/embed`);
      if (envelope.data.embed_url) setEmbedUrl(envelope.data.embed_url);
      return envelope.data.embed_url;
    } catch {
      return null;
    }
  }, [serviceName]);

  const installApp = useCallback(async () => {
    setPhase('installing');
    try {
      const envelope = await api.post<{ data: InstallResult }>(`/finance/${serviceName}/install`);
      const result = envelope.data;
      if (!result.success) {
        setError(result.error ?? 'Installation failed');
        setPhase('error');
        return;
      }
      if (result.credentials) setCredentials(result.credentials);
      setPhase('starting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setPhase('error');
    }
  }, [serviceName]);

  const startApp = useCallback(() => {
    setPhase('starting');
    // Fire-and-forget with a long timeout: the Core /start route blocks until the
    // app is healthy (up to ~2min on a cold first boot), which exceeds the default
    // 15s request timeout → "signal timed out". We don't await it here; the status
    // poll below detects `running` and flips to ready. Errors surface via the poll's
    // own timeout. (This is what made the FIRST click fail before.)
    api.post(`/finance/${serviceName}/start`, undefined, { timeout: 180_000 }).catch(() => {
      /* the starting-phase poll owns success/timeout */
    });
  }, [serviceName]);

  // Initial check
  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (!s) return;
      if (s.running) {
        await ensureEmbed();
        setPhase('ready');
      } else if (s.installed) {
        startApp();
      } else {
        setPhase('not-installed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll status during starting phase
  useEffect(() => {
    if (phase !== 'starting') return;
    const poll = setInterval(async () => {
      const s = await checkStatus();
      if (s?.running) {
        clearInterval(poll);
        await ensureEmbed();
        setPhase('ready');
      }
    }, 2000);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setPhase((p) => {
        if (p === 'starting') {
          setError('Service took too long to start');
          return 'error';
        }
        return p;
      });
    }, 120_000);
    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, [phase, checkStatus, ensureEmbed]);

  // Copy a one-time credential to the clipboard with brief visual feedback.
  // These creds are shown ONCE after install, so click-to-copy matters.
  const copyCred = (field: 'email' | 'password', value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Ready: iframe the embed proxy ─────────────────────────────
  if (phase === 'ready' && appStatus && embedUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
        {/* Header con controles. En fullscreen (?fullscreen=1 / botón) se colapsa. */}
        <div style={{
          height: fullscreen ? 0 : 36, overflow: 'hidden', display: 'flex', alignItems: 'center',
          padding: fullscreen ? 0 : '0 12px', borderBottom: fullscreen ? 'none' : '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, fontSize: 12, color: 'var(--text-dim)', flexShrink: 0,
        }}>
          <Icon size={14} style={{ color }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{displayName}</span>
          <div style={{ flex: 1 }} />
          <EmbedActions
            slug={serviceName}
            fallbackUrl={embedUrl}
            /* Open-in-new-tab MUST open the app's own proxy origin (auto-login via
               the proxy). Without this, useServiceUrl(slug) resolved to a stale/
               wrong service URL (it was opening CalibreWeb). */
            openUrl={embedUrl}
            ramMb={appStatus.ram_mb}
            fullscreen={fullscreen}
            onToggleFullscreen={toggle}
          />
        </div>
        {/* Banner de credenciales tras instalar (Firefly/SolidInvoice piden registro
            en su primer arranque; este banner solo aparece si install devuelve creds). */}
        {credentials && (
          <div style={{
            padding: '6px 12px', background: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--border)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Login (shown once):</span>
            {([
              ['email', credentials.admin_email] as const,
              ['password', credentials.admin_password] as const,
            ]).map(([field, value]) => {
              const isCopied = copiedField === field;
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => copyCred(field, value)}
                  title={`Copiar ${field === 'email' ? 'email' : 'password'}`}
                  aria-label={`Copiar ${field === 'email' ? 'email' : 'password'} al portapapeles`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg)',
                    padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)',
                    cursor: 'pointer', color: 'var(--text)',
                    fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
                  }}
                >
                  {value}
                  {isCopied
                    ? <Check size={12} style={{ color: 'var(--green, #22c55e)' }} />
                    : <Copy size={12} style={{ color: 'var(--text-muted)' }} />}
                </button>
              );
            })}
            <button onClick={() => setCredentials(null)} style={{
              marginLeft: 'auto', padding: '2px 8px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 11,
            }}>Dismiss</button>
          </div>
        )}
        <iframe
          src={embedUrl}
          title={displayName}
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
        {/* Salir de fullscreen (visible solo en fullscreen; ESC también). */}
        <button
          onClick={toggle}
          style={{
            position: 'fixed', top: 8, right: 8, zIndex: 60,
            opacity: fullscreen ? 1 : 0, pointerEvents: fullscreen ? 'auto' : 'none',
            transition: 'opacity 0.15s ease', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: '4px 8px', cursor: 'pointer', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          }}
          title="Exit full screen (ESC)"
        >
          <Minimize2 size={12} /> ESC
        </button>
      </div>
    );
  }

  // ─── Log panel (installing/starting) ───────────────────────────
  const logPanel = (phase === 'installing' || phase === 'starting') && (
    <div style={{
      marginTop: 12, width: '100%', maxWidth: 600, maxHeight: 180, overflow: 'auto',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '8px 12px',
      fontFamily: 'var(--font-mono, monospace)', fontSize: 11, lineHeight: 1.6, color: 'var(--text-muted)',
    }}>
      {startupLogs.length === 0 && <div style={{ opacity: 0.5 }}>Waiting for container logs...</div>}
      {startupLogs.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );

  // ─── Non-ready phases ──────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      color: 'var(--text-dim)', background: 'var(--bg)', ...rootStyle,
    }}>
      {(phase === 'loading' || (phase === 'ready' && !embedUrl)) && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Checking {displayName}...</span>
        </>
      )}

      {phase === 'not-installed' && (
        <>
          <Icon size={40} style={{ color, opacity: 0.6 }} />
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{displayName}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, textAlign: 'center' }}>
            {serviceName === 'firefly'
              ? 'Personal finance manager — budgets, expenses, and bank accounts.'
              : 'Open-source invoicing — clients, quotes, recurring billing, and payments.'}
          </span>
          <button onClick={installApp} style={{
            marginTop: 8, padding: '8px 20px', background: color, border: 'none',
            borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Download size={14} /> Install {displayName}
          </button>
        </>
      )}

      {phase === 'installing' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color }} />
          <span style={{ fontSize: 14 }}>Installing {displayName}...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Setting up database, generating credentials, and starting container
          </span>
          {logPanel}
        </>
      )}

      {phase === 'starting' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>Starting {displayName}...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a moment on first launch</span>
          {logPanel}
        </>
      )}

      {phase === 'error' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
          <span style={{ fontSize: 14 }}>Error with {displayName}</span>
          {error && <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 500, textAlign: 'center' }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/finance')} style={retryBtn}>Back</button>
            <button
              onClick={() => { setError(null); setPhase('loading'); checkStatus().then(async (s) => {
                if (!s) return;
                if (s.running) { await ensureEmbed(); setPhase('ready'); }
                else if (s.installed) startApp();
                else setPhase('not-installed');
              }); }}
              style={{ ...retryBtn, background: color, color: '#fff', border: 'none' }}
            >Retry</button>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const retryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};

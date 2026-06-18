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

// ─── OnlyOffice Editor ───────────────────────────────────────────────
// Embeds ONLYOFFICE Document Server via its JS API in an iframe.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Loader2, AlertTriangle, Minimize2, Download } from 'lucide-react';
import { useOfficeStore } from '@/stores/office.store';
import { useServicesStore } from '@/stores/services.store';
import { api } from '@/services/api';
import { resolveServiceUrl } from '@/config/service-urls';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useOfficeBridge } from './hooks/use-office-bridge';
import { useOfficeWs } from './hooks/use-office-ws';

// Fallback local (dev por http). En producción/.claw se resuelve en runtime a la
// URL https del document server (office.<dominio>) para evitar contenido mixto
// cuando el dash se sirve por https (victor.claw) — ver script.src abajo.
const ONLYOFFICE_FALLBACK_URL = import.meta.env.VITE_ONLYOFFICE_URL ?? 'http://127.0.0.1:8080';
const HEALTH_POLL_MS = 3_000;
const HEALTH_MAX_WAIT_MS = 300_000; // 5 min — ONLYOFFICE image pull + cold start can be slow

type Phase = 'loading' | 'starting' | 'waiting' | 'ready' | 'not-installed' | 'error';

interface OfficeStatusResponse {
  data: {
    onlyoffice: { installed: boolean; running: boolean; url: string | null };
  };
}

function ts(): string {
  return new Date().toLocaleTimeString('es-ES', { hour12: false });
}

export function Component() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<unknown>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [startupLogs, setStartupLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [pendingSession, setPendingSession] = useState<{ config: any; token: string } | null>(null);
  const { createSession, clearSession, fullscreen, toggleFullscreen, setFullscreen } = useOfficeStore();
  // RAM del document server (onlyoffice) desde el lifecycle store, igual que el resto de embebidos.
  const fetchServices = useServicesStore((s) => s.fetchServices);
  const ramMb = useServicesStore(
    (s) => s.services.find((svc) => svc.name === 'onlyoffice')?.ram_mb ?? null,
  );
  useEffect(() => {
    void fetchServices();
    const id = setInterval(() => void fetchServices(), 10_000);
    return () => clearInterval(id);
  }, [fetchServices]);
  // Dominio principal del sistema (victor.claw) para que "abrir en pestaña" lleve al dash
  // por su nombre y no al origen actual (que en dev es 127.0.0.1:7100). Fallback al origen.
  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  // Modo de apertura: embebido en el módulo (desde OfficeLauncher) por defecto;
  // pantalla completa si se llega con ?fullscreen=1 (atajos docs/sheets/presentations).
  useEffect(() => {
    setFullscreen(searchParams.get('fullscreen') === '1');
    // solo al montar / cambiar de documento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);
  // Track whether we've been through a startup phase (to keep logs visible during brief loading transitions)
  const wasWaitingRef = useRef(false);
  // Track if first poll (to use broader log window)
  const isFirstPollRef = useRef(true);

  // Helper to add a client-side progress message
  const addLog = useCallback((msg: string) => {
    setStartupLogs((prev) => [...prev, `[${ts()}] ${msg}`].slice(-100));
  }, []);

  // ─── Poll container logs during startup ──────────────────────────
  const seenLogsRef = useRef(new Set<string>());
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'waiting') return;
    wasWaitingRef.current = true;

    const poll = async () => {
      try {
        // First poll: get last 30 lines regardless of age. Subsequent: last 15 from last 5s.
        const query = isFirstPollRef.current
          ? '/hal/processes/docker:claw-onlyoffice/logs?tail=30'
          : '/hal/processes/docker:claw-onlyoffice/logs?tail=15&since=5s';
        isFirstPollRef.current = false;

        const res = await api.get<{ data: { lines: string[] } }>(query);
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
  }, [phase]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [startupLogs]);

  // ─── AI Bridge ────────────────────────────────────────────────────
  const bridge = useOfficeBridge();
  useOfficeWs(bridge);

  // ─── Poll until ONLYOFFICE is running ──────────────────────────────
  const waitForOnlyOffice = useCallback(async (): Promise<boolean> => {
    const deadline = Date.now() + HEALTH_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      try {
        const res = await api.get<OfficeStatusResponse>('/office/status');
        if (res.data.onlyoffice.running) return true;
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
    }
    return false;
  }, []);

  // ─── Load the ONLYOFFICE JS API script (with retries) ───────────────
  const loadApiScript = useCallback(async (log: (msg: string) => void): Promise<boolean> => {
    if ((window as any).DocsAPI) return true;

    // Resuelve la base del document server en runtime. En una página https
    // (p.ej. victor.claw) carga api.js desde el dominio del sistema
    // (https://office.<dom>) para evitar contenido mixto; en http (dev) usa el
    // fallback local para que un certificado .claw aún no confiable no bloquee el
    // editor. El catálogo se indexa por slug de servicio: 'onlyoffice' → office.<dom>
    // (la clave 'office' NO existe → antes caía SIEMPRE al http, rompiendo .claw).
    const isHttps = window.location.protocol === 'https:';
    if (isHttps) await useServiceUrlsStore.getState().load(true);
    const onlyofficeBase = (
      isHttps ? resolveServiceUrl('onlyoffice', ONLYOFFICE_FALLBACK_URL) : ONLYOFFICE_FALLBACK_URL
    ).replace(/\/$/, '');

    const maxAttempts = 40; // Up to ~120s of retries (3s between each)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && attempt % 5 === 0) {
        log(`Loading ONLYOFFICE editor script (attempt ${attempt}/${maxAttempts})...`);
      }

      // Remove any previous failed script tags
      const existing = document.querySelector('script[data-onlyoffice-api]');
      if (existing) existing.remove();

      const loaded = await new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = `${onlyofficeBase}/web-apps/apps/api/documents/api.js`;
        script.setAttribute('data-onlyoffice-api', 'true');
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });

      if (loaded && (window as any).DocsAPI) return true;

      // Wait before retrying — ONLYOFFICE internal services may still be initializing
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
      }
    }

    return false;
  }, []);

  // ─── Main init flow ────────────────────────────────────────────────
  const initEditor = useCallback(async () => {
    if (!fileId) return;

    // Reset state at the beginning of a full init
    seenLogsRef.current.clear();
    isFirstPollRef.current = true;
    wasWaitingRef.current = false;
    setStartupLogs([]);
    setPendingSession(null);
    if (editorRef.current && (editorRef.current as any).destroyEditor) {
      (editorRef.current as any).destroyEditor();
    }
    editorRef.current = null;
    setPhase('loading');
    setError(null);

    try {
      // 1. Check ONLYOFFICE status
      addLog('Checking ONLYOFFICE status...');
      let ooRunning = false;
      try {
        const statusRes = await api.get<OfficeStatusResponse>('/office/status');
        const oo = statusRes.data.onlyoffice;

        if (!oo.installed) {
          addLog('ONLYOFFICE is not installed.');
          setPhase('not-installed');
          return;
        }

        ooRunning = oo.running;
        addLog(ooRunning ? 'ONLYOFFICE container is running.' : 'ONLYOFFICE container is not running.');
      } catch {
        addLog('Could not reach status endpoint — proceeding anyway.');
      }

      // 2. Start ONLYOFFICE if not running
      if (!ooRunning) {
        setPhase('starting');
        addLog('Sending start command...');
        try {
          await api.post('/office/start/onlyoffice');
          addLog('Start command sent. Waiting for container to report running...');
        } catch {
          addLog('Start command failed (RAM budget?) — polling anyway...');
        }

        setPhase('waiting');
        const started = await waitForOnlyOffice();
        if (!started) {
          addLog('ERROR: ONLYOFFICE did not start within the timeout.');
          setError('ONLYOFFICE did not start within the timeout. Check available RAM.');
          setPhase('error');
          return;
        }
        addLog('Container is running.');
      }

      // 3. Create editor session (JWT + config)
      setPhase('waiting');
      addLog('Creating editor session...');
      const session = await createSession(fileId);
      addLog('Session created. Loading ONLYOFFICE editor script...');

      // 4. Load ONLYOFFICE JS API (retries until ONLYOFFICE internal services are ready)
      const apiLoaded = await loadApiScript(addLog);
      if (!apiLoaded) {
        addLog('ERROR: Could not load ONLYOFFICE editor script after 40 attempts.');
        setError('Could not connect to ONLYOFFICE Document Server after multiple attempts. Check that port 8080 is accessible.');
        setPhase('error');
        return;
      }

      // 5. Store session and switch to ready (editor created in useEffect after DOM renders)
      addLog('Initializing editor...');
      setPendingSession(session);
      setPhase('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open editor';
      addLog(`ERROR: ${msg}`);
      setError(msg);
      setPhase('error');
    }
  }, [fileId, createSession, waitForOnlyOffice, loadApiScript, addLog]);

  // ─── Create editor once phase=ready and container div is in the DOM ──
  useEffect(() => {
    if (phase !== 'ready' || !pendingSession || editorRef.current) return;

    // Small delay to ensure React has flushed the DOM
    const raf = requestAnimationFrame(() => {
      if (containerRef.current && (window as any).DocsAPI) {
        editorRef.current = new (window as any).DocsAPI.DocEditor('onlyoffice-editor', {
          ...pendingSession.config,
          token: pendingSession.token,
          height: '100%',
          width: '100%',
        });
      }
      setPendingSession(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, pendingSession]);

  useEffect(() => {
    initEditor();
    return () => {
      if (editorRef.current && (editorRef.current as any).destroyEditor) {
        (editorRef.current as any).destroyEditor();
      }
      clearSession();
    };
  }, [initEditor, clearSession]);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) toggleFullscreen();
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen, toggleFullscreen]);

  // Should the log panel be visible?
  const showLogs = phase === 'starting' || phase === 'waiting' || (phase === 'loading' && wasWaitingRef.current);

  // ─── Non-ready states ──────────────────────────────────────────────
  if (phase !== 'ready') {
    return (
      <div style={{
        position: fullscreen ? 'fixed' : 'absolute', inset: 0, ...(fullscreen ? { zIndex: 50 } : {}),
        display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, color: 'var(--text-dim)', background: 'var(--bg)',
      }}>
        {(phase === 'loading') && (
          <>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14 }}>
              {wasWaitingRef.current ? 'Preparing editor...' : 'Opening document...'}
            </span>
          </>
        )}

        {(phase === 'starting' || phase === 'waiting') && (
          <>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
            <span style={{ fontSize: 14 }}>
              {phase === 'starting' ? 'Starting ONLYOFFICE Document Server...' : 'Waiting for ONLYOFFICE to be ready...'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              This may take up to 90 seconds on first launch
            </span>
          </>
        )}

        {phase === 'not-installed' && (
          <>
            <Download size={32} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>ONLYOFFICE is not installed</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center' }}>
              ONLYOFFICE Document Server is required for editing documents in the browser.
              It will be automatically downloaded and installed (~500 MB).
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => navigate('/office')} style={secondaryBtn}>
                Back to Office
              </button>
              <button
                onClick={async () => {
                  setPhase('starting');
                  try {
                    await api.post('/office/start/onlyoffice');
                    setPhase('waiting');
                    const started = await waitForOnlyOffice();
                    if (started) {
                      await initEditor();
                    } else {
                      setError('Installation timed out. Check available disk space and RAM.');
                      setPhase('error');
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Installation failed');
                    setPhase('error');
                  }
                }}
                style={primaryBtn}
              >
                Install & Start
              </button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: 14 }}>Failed to open document</span>
            {error && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center' }}>
                {error}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => navigate('/office')} style={secondaryBtn}>
                Back to Office
              </button>
              <button onClick={initEditor} style={primaryBtn}>
                Retry
              </button>
            </div>
          </>
        )}

        {/* ─── Log panel — always visible during startup/waiting ──── */}
        {showLogs && (
          <div style={{
            marginTop: 12, width: '100%', maxWidth: 600,
            maxHeight: 200, minHeight: 60, overflow: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '8px 12px',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
            lineHeight: 1.6, color: 'var(--text-muted)',
          }}>
            {startupLogs.length === 0 && (
              <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Fetching logs...</div>
            )}
            {startupLogs.map((line, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* ─── Log panel in error state — show last logs ──── */}
        {phase === 'error' && startupLogs.length > 0 && (
          <div style={{
            marginTop: 8, width: '100%', maxWidth: 600,
            maxHeight: 150, overflow: 'auto',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '8px 12px',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
            lineHeight: 1.6, color: 'var(--text-muted)',
          }}>
            {startupLogs.map((line, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Ready: show editor (pantalla completa sobre el dash) ──────────
  // ESTRUCTURA ESTABLE: la barra y el botón de salir van SIEMPRE en el árbol
  // (solo cambian de tamaño/opacidad, nunca se añaden/quitan) y el contenedor del
  // editor es siempre el mismo hijo. Si se añadieran/quitaran hermanos del editor,
  // React intentaría reconciliar junto al DOM que ONLYOFFICE inyecta → crash
  // "insertBefore: node is not a child". position:fixed cubre todo el dash.
  return (
    <div style={{
      position: fullscreen ? 'fixed' : 'absolute', inset: 0, ...(fullscreen ? { zIndex: 50 } : {}),
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Toolbar (siempre presente; altura 0 en pantalla completa) ── */}
      <div style={{
        height: fullscreen ? 0 : 36, overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
        padding: fullscreen ? '0' : '0 12px',
        borderBottom: fullscreen ? 'none' : '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text-dim)',
        transition: 'height 0.12s ease',
      }}>
        <button onClick={() => navigate('/office')} style={iconBtn} title="Volver a Office">
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>Office Editor</span>
        <div style={{ flex: 1 }} />
        <EmbedActions
          slug="onlyoffice" fallbackUrl={ONLYOFFICE_FALLBACK_URL} ramMb={ramMb}
          openUrl={
            fileId
              ? `${dashOrigin}/office/edit/${fileId}?fullscreen=1`
              : `${dashOrigin}/office`
          }
          fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {/* ─── Editor container (hijo estable, nunca se reordena) ──────── */}
      <div ref={containerRef} id="onlyoffice-editor" style={{ flex: 1 }} />

      {/* ─── Salir de pantalla completa (siempre en el árbol; opacidad) ── */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 60,
          opacity: fullscreen ? 1 : 0, pointerEvents: fullscreen ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '4px 8px',
          cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11,
        }}
        title="Salir de pantalla completa (ESC)"
      >
        <Minimize2 size={12} /> ESC
      </button>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
};

const secondaryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--mod-office)',
  border: 'none', borderRadius: 'var(--radius-md)',
  color: '#fff', cursor: 'pointer', fontSize: 13,
};

// ─── OnlyOffice Editor ───────────────────────────────────────────────
// Embeds ONLYOFFICE Document Server via its JS API in an iframe.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, AlertTriangle, Maximize2, Minimize2, Download, PenTool } from 'lucide-react';
import { useOfficeStore } from '@/stores/office.store';
import { api } from '@/services/api';
import { useOfficeBridge } from './hooks/use-office-bridge';
import { useOfficeWs } from './hooks/use-office-ws';
import { SignatureDialog } from './SignatureDialog';

const ONLYOFFICE_API_URL = import.meta.env.VITE_ONLYOFFICE_URL ?? 'http://127.0.0.1:8080';
const HEALTH_POLL_MS = 3_000;
const HEALTH_MAX_WAIT_MS = 300_000; // 5 min — ONLYOFFICE image pull + cold start can be slow

type Phase = 'loading' | 'starting' | 'waiting' | 'ready' | 'not-installed' | 'error';

interface OfficeStatusResponse {
  data: {
    onlyoffice: { installed: boolean; running: boolean; url: string | null };
  };
}

export function Component() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<unknown>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [startupLogs, setStartupLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { createSession, clearSession, fullscreen, toggleFullscreen, currentSession } = useOfficeStore();
  const [signOpen, setSignOpen] = useState(false);
  const filename = (currentSession?.config as any)?.document?.title ?? 'document';

  // ─── Poll container logs during startup ──────────────────────────
  const seenLogsRef = useRef(new Set<string>());
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'waiting') return;
    seenLogsRef.current.clear();
    setStartupLogs([]);

    const poll = async () => {
      try {
        const res = await api.get<{ data: { lines: string[] } }>(
          '/hal/processes/docker:claw-onlyoffice/logs?tail=15&since=5s',
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
  const loadApiScript = useCallback(async (): Promise<boolean> => {
    if ((window as any).DocsAPI) return true;

    const maxAttempts = 20; // Up to ~60s of retries (3s between each)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Remove any previous failed script tags
      const existing = document.querySelector('script[data-onlyoffice-api]');
      if (existing) existing.remove();

      const loaded = await new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = `${ONLYOFFICE_API_URL}/web-apps/apps/api/documents/api.js`;
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

    setPhase('loading');
    setError(null);

    try {
      // 1. Check ONLYOFFICE status
      let ooRunning = false;
      try {
        const statusRes = await api.get<OfficeStatusResponse>('/office/status');
        const oo = statusRes.data.onlyoffice;

        if (!oo.installed) {
          setPhase('not-installed');
          return;
        }

        ooRunning = oo.running;
      } catch {
        // Status endpoint might fail if core is down — proceed anyway
      }

      // 2. Start ONLYOFFICE if not running
      if (!ooRunning) {
        setPhase('starting');
        try {
          await api.post('/office/start/onlyoffice');
        } catch {
          // Start might fail (RAM budget, etc.) — we'll still poll
        }

        setPhase('waiting');
        const started = await waitForOnlyOffice();
        if (!started) {
          setError('ONLYOFFICE did not start within the timeout. Check available RAM.');
          setPhase('error');
          return;
        }
      }

      // 3. Create editor session (JWT + config)
      setPhase('loading');
      const session = await createSession(fileId);

      // 4. Load ONLYOFFICE JS API (retries until ONLYOFFICE internal services are ready)
      setPhase('waiting');
      const apiLoaded = await loadApiScript();
      if (!apiLoaded) {
        setError('Could not connect to ONLYOFFICE Document Server after multiple attempts. Check that port 8080 is accessible.');
        setPhase('error');
        return;
      }

      // 5. Initialize the editor
      if (containerRef.current && (window as any).DocsAPI) {
        editorRef.current = new (window as any).DocsAPI.DocEditor('onlyoffice-editor', {
          ...session.config,
          token: session.token,
          height: '100%',
          width: '100%',
        });
      }

      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open editor');
      setPhase('error');
    }
  }, [fileId, createSession, waitForOnlyOffice, loadApiScript]);

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

  // ─── Non-ready states ──────────────────────────────────────────────
  if (phase !== 'ready') {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, color: 'var(--text-dim)', background: 'var(--bg)',
      }}>
        {phase === 'loading' && (
          <>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14 }}>Opening document...</span>
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
            {startupLogs.length > 0 && (
              <div style={{
                marginTop: 12, width: '100%', maxWidth: 600,
                maxHeight: 180, overflow: 'auto',
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

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Ready: show editor ────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ─── Toolbar ──────────────────────────────────── */}
      {!fullscreen && (
        <div style={{
          height: 36, display: 'flex', alignItems: 'center',
          padding: '0 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, fontSize: 12,
          color: 'var(--text-dim)', flexShrink: 0,
        }}>
          <button
            onClick={() => navigate('/office')}
            style={iconBtn}
          >
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>Office Editor</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSignOpen(true)} style={signBtn} title="Firmar con DocuSeal">
            <PenTool size={14} />
            <span>Firmar con DocuSeal</span>
          </button>
          <button
            onClick={toggleFullscreen}
            style={iconBtn}
            title="Toggle fullscreen (Ctrl+Shift+F)"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      {/* ─── Fullscreen exit button ───────────────────── */}
      {fullscreen && (
        <button
          onClick={toggleFullscreen}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '4px 8px',
            cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11,
          }}
        >
          <Minimize2 size={12} /> ESC
        </button>
      )}

      {/* ─── Signature dialog ────────────────────────── */}
      <SignatureDialog fileId={fileId!} filename={filename} open={signOpen} onClose={() => setSignOpen(false)} />

      {/* ─── Editor container ─────────────────────────── */}
      <div ref={containerRef} id="onlyoffice-editor" style={{ flex: 1 }} />
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

const signBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '4px 12px',
  background: '#7c3aed',
  border: 'none', borderRadius: 'var(--radius-md)',
  color: '#fff', cursor: 'pointer', fontSize: 12,
  fontWeight: 500, whiteSpace: 'nowrap',
};

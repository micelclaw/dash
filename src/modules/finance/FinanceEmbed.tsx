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

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { AlertTriangle, Loader2, ExternalLink, Download } from 'lucide-react';

interface FinanceAppStatus {
  name: string;
  installed: boolean;
  running: boolean;
  url: string | null;
  database: string;
  ram_mb: number | null;
}

interface FinanceSuiteStatus {
  mariadb: { installed: boolean; running: boolean; ram_mb: number | null };
  apps: FinanceAppStatus[];
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
  port: number;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}

export function FinanceEmbed({ serviceName, displayName, port, icon: Icon, color }: FinanceEmbedProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [appStatus, setAppStatus] = useState<FinanceAppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<InstallResult['credentials']>(null);
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
          `/hal/processes/${encodeURIComponent(processId)}/logs?tail=20&since=10s`,
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
      if (result.credentials) {
        setCredentials(result.credentials);
      }
      // After install, start polling for ready
      setPhase('starting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setPhase('error');
    }
  }, [serviceName]);

  const startApp = useCallback(async () => {
    setPhase('starting');
    try {
      await api.post(`/finance/${serviceName}/start`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setPhase('error');
    }
  }, [serviceName]);

  // Initial check
  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (!s) return;
      if (s.running) {
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
  }, [phase, checkStatus]);

  // ─── Log panel (shared between installing/starting) ────────────
  const logPanel = (phase === 'installing' || phase === 'starting') && (
    <div style={{
      marginTop: 12, width: '100%', maxWidth: 600,
      maxHeight: 180, overflow: 'auto',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '8px 12px',
      fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
      lineHeight: 1.6, color: 'var(--text-muted)',
    }}>
      {startupLogs.length === 0 && (
        <div style={{ opacity: 0.5 }}>Waiting for container logs...</div>
      )}
      {startupLogs.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );

  // Ready — open in new tab (no iframe embedding)
  const openInNewTab = useCallback(() => {
    window.open(`http://localhost:${port}`, '_blank');
  }, [port]);

  // Auto-open on first ready
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (phase === 'ready' && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      openInNewTab();
    }
  }, [phase, openInNewTab]);

  if (phase === 'ready' && appStatus) {
    const directUrl = `http://localhost:${port}`;
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text-dim)',
        background: 'var(--bg)',
      }}>
        {/* ─── Credentials banner (shown once after install) ── */}
        {credentials && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Login credentials (shown once):</span>
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
              {credentials.admin_email}
            </code>
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
              {credentials.admin_password}
            </code>
            <button
              onClick={() => setCredentials(null)}
              style={{
                marginLeft: 'auto',
                padding: '2px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <Icon size={40} style={{ color, opacity: 0.8 }} />
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{displayName}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Running on {directUrl}
        </span>
        {appStatus.ram_mb != null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>RAM: {appStatus.ram_mb} MB</span>
        )}
        <button
          onClick={openInNewTab}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            background: color,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ExternalLink size={16} />
          Open {displayName}
        </button>
      </div>
    );
  }

  // Non-ready phases
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      color: 'var(--text-dim)',
      background: 'var(--bg)',
    }}>
      {phase === 'loading' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Checking {displayName} status...</span>
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
          <button
            onClick={installApp}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              background: color,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={14} />
            Install {displayName}
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
          <button
            onClick={() => { setError(null); setPhase('loading'); checkStatus().then(s => {
              if (!s) return;
              if (s.running) setPhase('ready');
              else if (s.installed) startApp();
              else setPhase('not-installed');
            }); }}
            style={{
              marginTop: 8,
              padding: '6px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

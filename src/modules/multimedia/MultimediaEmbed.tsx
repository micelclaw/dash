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

interface MultimediaAppStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

interface MultimediaSuiteStatus {
  media_dirs: { name: string; path: string; exists: boolean }[];
  apps: MultimediaAppStatus[];
}

type Phase = 'loading' | 'not-installed' | 'installing' | 'starting' | 'ready' | 'error';

const CONTAINER_MAP: Record<string, string> = {
  jellyfin: 'docker:claw-jellyfin',
  qbittorrent: 'docker:claw-qbittorrent',
  radarr: 'docker:claw-radarr',
  sonarr: 'docker:claw-sonarr',
  lidarr: 'docker:claw-lidarr',
  readarr: 'docker:claw-readarr',
  jackett: 'docker:claw-jackett',
  jellyseerr: 'docker:claw-jellyseerr',
  navidrome: 'docker:claw-navidrome',
  calibreweb: 'docker:claw-calibreweb',
  audiobookshelf: 'docker:claw-audiobookshelf',
};

interface MultimediaEmbedProps {
  serviceName: string;
  displayName: string;
  description: string;
  port: number;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}

export function MultimediaEmbed({ serviceName, displayName, description, port, icon: Icon, color }: MultimediaEmbedProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [appStatus, setAppStatus] = useState<MultimediaAppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const envelope = await api.get<{ data: MultimediaSuiteStatus }>('/multimedia/status');
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
      const envelope = await api.post<{ data: { success: boolean; error: string | null } }>(
        `/multimedia/${serviceName}/install`,
      );
      const result = envelope.data;
      if (!result.success) {
        setError(result.error ?? 'Installation failed');
        setPhase('error');
        return;
      }
      setPhase('starting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setPhase('error');
    }
  }, [serviceName]);

  const startApp = useCallback(async () => {
    setPhase('starting');
    try {
      await api.post(`/multimedia/${serviceName}/start`);
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
  const logPanel = startupLogs.length > 0 && (
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
  );

  // Ready — iframe view
  if (phase === 'ready' && appStatus) {
    const url = `http://localhost:${port}`;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header bar */}
        <div style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          <Icon size={14} style={{ color }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{displayName}</span>
          <span style={{ color: 'var(--text-muted)' }}>{description}</span>
          <div style={{ flex: 1 }} />
          {appStatus.ram_mb != null && (
            <span style={{ color: 'var(--text-muted)' }}>RAM: {appStatus.ram_mb} MB</span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Iframe */}
        <iframe
          src={url}
          title={displayName}
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
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
            {description}
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
            Pulling image and starting container
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

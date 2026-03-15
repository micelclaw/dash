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

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Container, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

interface PortainerStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

type Phase = 'loading' | 'installing' | 'ready' | 'error';

function formatUptime(seconds: number | null): string {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function Component() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<PortainerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const envelope = await api.get<{ data: PortainerStatus }>('/portainer/status', undefined, { timeout: 45_000 });
      const res = envelope.data;
      setStatus(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Portainer status');
      setPhase('error');
      return null;
    }
  }, []);

  const startPortainer = useCallback(async () => {
    setPhase('installing');
    try {
      const envelope = await api.post<{ data: PortainerStatus }>('/portainer/start', undefined, { timeout: 45_000 });
      const res = envelope.data;
      setStatus(res);
      if (res.running) {
        setPhase('ready');
      } else {
        const poll = setInterval(async () => {
          const s = await checkStatus();
          if (s?.running) {
            clearInterval(poll);
            setPhase('ready');
          }
        }, 2000);
        setTimeout(() => clearInterval(poll), 120_000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Portainer');
      setPhase('error');
    }
  }, [checkStatus]);

  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (!s) return;
      if (s.running) {
        setPhase('ready');
      } else {
        await startPortainer();
      }
    })();
  }, [checkStatus, startPortainer]);

  if (phase === 'ready' && status?.url) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {/* ─── Header bar ─────────────────────────────────── */}
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
          <Container size={14} style={{ color: '#13bef9' }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>Portainer</span>
          <span style={{ color: 'var(--text-muted)' }}>Docker Management</span>
          <div style={{ flex: 1 }} />
          {status.ram_mb != null && (
            <span style={{ color: 'var(--text-muted)' }}>RAM: {status.ram_mb} MB</span>
          )}
          {status.uptime_seconds != null && (
            <span style={{ color: 'var(--text-muted)' }}>Up: {formatUptime(status.uptime_seconds)}</span>
          )}
          <a
            href="http://localhost:9000"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>
        {/* ─── Iframe ─────────────────────────────────────── */}
        <iframe
          src={status.url}
          title="Portainer Docker Management"
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

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
          <span style={{ fontSize: 14 }}>Checking Portainer status...</span>
        </>
      )}

      {phase === 'installing' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>Setting up Portainer...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a moment on first launch</span>
        </>
      )}

      {phase === 'error' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
          <span style={{ fontSize: 14 }}>Error connecting to Portainer</span>
          {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
          <button
            onClick={() => { setError(null); startPortainer(); }}
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

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { ExternalLink, AlertTriangle, Loader2, Power, PowerOff } from 'lucide-react';

interface TermixStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

type Phase = 'loading' | 'installing' | 'ready' | 'stopped' | 'error';

export function Component() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<TermixStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const envelope = await api.get<{ data: TermixStatus }>('/termix/status');
      const res = envelope.data;
      setStatus(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Termix status');
      setPhase('error');
      return null;
    }
  }, []);

  const startTermix = useCallback(async () => {
    setPhase('installing');
    try {
      const envelope = await api.post<{ data: TermixStatus }>('/termix/start');
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
      setError(err instanceof Error ? err.message : 'Failed to start Termix');
      setPhase('error');
    }
  }, [checkStatus]);

  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (!s) return;
      if (s.running) {
        setPhase('ready');
      } else if (s.installed) {
        setPhase('stopped');
      } else {
        await startTermix();
      }
    })();
  }, [checkStatus, startTermix]);

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

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
          <span style={{ fontSize: 14 }}>Checking Terminal status...</span>
        </>
      )}

      {phase === 'installing' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>Setting up Terminal...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a moment on first launch</span>
        </>
      )}

      {phase === 'ready' && status?.url && (
        <>
          <ExternalLink size={40} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Termix Terminal</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
            SSH server manager running
            {status.ram_mb != null && ` · ${status.ram_mb} MB`}
            {status.uptime_seconds != null && ` · ${formatUptime(status.uptime_seconds)}`}
          </span>
          <a
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <ExternalLink size={16} />
            Open Termix
          </a>
        </>
      )}

      {phase === 'stopped' && (
        <>
          <PowerOff size={32} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14 }}>Terminal is stopped</span>
          <button
            onClick={() => startTermix()}
            style={{
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <Power size={14} />
            Start Terminal
          </button>
        </>
      )}

      {phase === 'error' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
          <span style={{ fontSize: 14 }}>Error connecting to Terminal</span>
          {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
          <button
            onClick={() => { setError(null); startTermix(); }}
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

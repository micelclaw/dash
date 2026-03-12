import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Loader2, AlertTriangle, ExternalLink, Cpu } from 'lucide-react';

interface ServiceStatus {
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
}

type Phase = 'loading' | 'installing' | 'ready' | 'error';

function formatUptime(s: number | null): string {
  if (!s) return '';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function Component() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: { services: ServiceStatus[] } }>('/crypto/status');
      const svc = (res.data as any).services?.find((s: any) => s.name === 'rotki');
      if (svc) setStatus(svc);
      return svc ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setPhase('error');
      return null;
    }
  }, []);

  const startService = useCallback(async () => {
    setPhase('installing');
    try {
      await api.post('/crypto/rotki/start');
      const poll = setInterval(async () => {
        const s = await checkStatus();
        if (s?.running) {
          clearInterval(poll);
          setPhase('ready');
        }
      }, 2000);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setPhase('error');
    }
  }, [checkStatus]);

  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (!s) {
        setError('Rotki is not installed yet');
        setPhase('error');
        return;
      }
      if (s.running) {
        setPhase('ready');
      } else {
        await startService();
      }
    })();
  }, [checkStatus, startService]);

  if (phase === 'ready') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: 36, display: 'flex', alignItems: 'center', padding: '0 12px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          gap: 8, fontSize: 12, color: 'var(--text-dim)', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>Rotki</span>
          <span style={{ color: 'var(--text-muted)' }}>Portfolio Tracker</span>
          <div style={{ flex: 1 }} />
          {status?.ram_mb != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)' }}>
              <Cpu size={11} /> {status.ram_mb} MB
            </span>
          )}
          {status?.uptime_seconds != null && (
            <span style={{ color: 'var(--text-muted)' }}>Up: {formatUptime(status.uptime_seconds)}</span>
          )}
          <a href="http://localhost:5000" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Open in new tab">
            <ExternalLink size={13} />
          </a>
        </div>
        <iframe src="http://localhost:5000" title="Rotki" style={{ flex: 1, border: 'none', background: '#fff' }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      color: 'var(--text-dim)', background: 'var(--bg)',
    }}>
      {phase === 'loading' && (<><Loader2 size={32} className="spin" /><span>Checking Rotki...</span></>)}
      {phase === 'installing' && (<><Loader2 size={32} className="spin" style={{ color: 'var(--amber)' }} /><span>Starting Rotki...</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Portfolio tracker</span></>)}
      {phase === 'error' && (<><AlertTriangle size={32} style={{ color: 'var(--error)' }} /><span>Error</span>{error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}<button onClick={() => { setError(null); checkStatus().then(s => { if (s) startService(); }); }} className="crypto-btn">Retry</button></>)}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } .crypto-btn { padding: 6px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); cursor: pointer; font-size: 13px; }`}</style>
    </div>
  );
}

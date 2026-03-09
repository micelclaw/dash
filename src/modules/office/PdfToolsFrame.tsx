// ─── PDF Tools Frame ─────────────────────────────────────────────────
// Embeds Stirling PDF in a full-viewport iframe.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Wrench, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';

interface StirlingStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

type Phase = 'loading' | 'starting' | 'ready' | 'error';

export function Component() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<StirlingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkAndStart = useCallback(async () => {
    try {
      const res = await api.get<{ data: { stirling_pdf: StirlingStatus } }>('/office/status');
      const sp = res.data.stirling_pdf;
      setStatus(sp);

      if (sp.running && sp.url) {
        setPhase('ready');
        return;
      }

      // Auto-start
      setPhase('starting');
      await api.post('/office/start/stirling-pdf');

      // Poll until ready
      let resolved = false;
      const poll = setInterval(async () => {
        try {
          const r2 = await api.get<{ data: { stirling_pdf: StirlingStatus } }>('/office/status');
          const s2 = r2.data.stirling_pdf;
          setStatus(s2);
          if (s2.running && s2.url) {
            resolved = true;
            clearInterval(poll);
            setPhase('ready');
          }
        } catch { /* keep polling */ }
      }, 2000);

      setTimeout(() => {
        clearInterval(poll);
        if (!resolved) {
          setError('Stirling PDF failed to start within timeout');
          setPhase('error');
        }
      }, 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Stirling PDF');
      setPhase('error');
    }
  }, []);

  useEffect(() => { checkAndStart(); }, [checkAndStart]);

  if (phase === 'ready' && status?.url) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: 36, display: 'flex', alignItems: 'center',
          padding: '0 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, fontSize: 12,
          color: 'var(--text-dim)', flexShrink: 0,
        }}>
          <button onClick={() => navigate('/office')} style={iconBtn}>
            <ArrowLeft size={14} />
          </button>
          <Wrench size={14} style={{ color: 'var(--mod-office)' }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>Stirling PDF</span>
          <span style={{ color: 'var(--text-muted)' }}>PDF Tools</span>
          <div style={{ flex: 1 }} />
          {status.ram_mb != null && (
            <span style={{ color: 'var(--text-muted)' }}>RAM: {status.ram_mb} MB</span>
          )}
          <a
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...iconBtn, textDecoration: 'none' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>
        <iframe
          src={status.url}
          title="Stirling PDF Tools"
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, color: 'var(--text-dim)', background: 'var(--bg)',
    }}>
      {phase === 'loading' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Checking Stirling PDF...</span>
        </>
      )}
      {phase === 'starting' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>Starting Stirling PDF...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a moment on first launch</span>
        </>
      )}
      {phase === 'error' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
          <span style={{ fontSize: 14 }}>Error with Stirling PDF</span>
          {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/office')} style={retryBtn}>Back to Office</button>
            <button onClick={() => { setError(null); checkAndStart(); }} style={{ ...retryBtn, background: 'var(--mod-office)', color: '#fff', border: 'none' }}>
              Retry
            </button>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
};

const retryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};

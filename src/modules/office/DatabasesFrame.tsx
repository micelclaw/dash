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

// ─── Databases Frame ─────────────────────────────────────────────────
// Embebe Mathesar (gestor de DB tipo Access) en un iframe a viewport completo.
// El iframe carga el PROXY same-origin de Core (/api/v1/databases/ui/), que strippea
// X-Frame-Options; NO la URL interna 127.0.0.1:8090 (la bloquearía el navegador).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Database, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useOfficeStore } from '@/stores/office.store';
import { useServiceUrlsStore } from '@/stores/service-urls.store';

// URL same-origin del proxy de Core hacia Mathesar (ver core/src/routes/databases.ts).
const MATHESAR_UI = '/api/v1/databases/ui/';

interface MathesarStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

type Phase = 'loading' | 'starting' | 'ready' | 'error';

export function Component() {
  const navigate = useNavigate();
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<MathesarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al salir del frame, resetear la app activa → OfficeLauncher no re-redirige aquí
  // (su effect navega a /office/databases mientras activeApp siga siendo 'databases').
  const setActiveApp = useOfficeStore((s) => s.setActiveApp);
  useEffect(() => () => { setActiveApp('documents'); }, [setActiveApp]);

  // Dominio del sistema para abrir-en-pestaña-nueva la ruta del dash (no la URL del proxy).
  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  const checkAndStart = useCallback(async () => {
    try {
      const res = await api.get<{ data: { mathesar: MathesarStatus } }>('/office/status');
      const ms = res.data.mathesar;
      setStatus(ms);

      if (ms.running) {
        setPhase('ready');
        return;
      }

      // Auto-start
      setPhase('starting');
      await api.post('/office/start/mathesar');

      // Poll until ready (Mathesar tarda: migraciones Django + 2 contenedores)
      let resolved = false;
      const poll = setInterval(async () => {
        try {
          const r2 = await api.get<{ data: { mathesar: MathesarStatus } }>('/office/status');
          const s2 = r2.data.mathesar;
          setStatus(s2);
          if (s2.running) {
            resolved = true;
            clearInterval(poll);
            setPhase('ready');
          }
        } catch { /* keep polling */ }
      }, 2500);

      setTimeout(() => {
        clearInterval(poll);
        if (!resolved) {
          setError('Mathesar failed to start within timeout');
          setPhase('error');
        }
      }, 150_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check Databases');
      setPhase('error');
    }
  }, []);

  useEffect(() => { checkAndStart(); }, [checkAndStart]);

  if (phase === 'ready') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
        <div style={{
          height: 36, display: 'flex', alignItems: 'center',
          padding: '0 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', gap: 8, fontSize: 12,
          color: 'var(--text-dim)', flexShrink: 0,
        }}>
          <button onClick={() => navigate('/office')} style={iconBtn}>
            <ArrowLeft size={14} />
          </button>
          <Database size={14} style={{ color: '#a855f7' }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>Databases</span>
          <span style={{ color: 'var(--text-muted)' }}>Mathesar</span>
          <div style={{ flex: 1 }} />
          <EmbedActions
            slug="mathesar" fallbackUrl={MATHESAR_UI} ramMb={status?.ram_mb}
            openUrl={`${dashOrigin}/office/databases`}
            fullscreen={fullscreen} onToggleFullscreen={toggle}
          />
        </div>
        <iframe
          src={MATHESAR_UI}
          title="Mathesar Databases"
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
      gap: 16, color: 'var(--text-dim)', background: 'var(--bg)', ...rootStyle,
    }}>
      {phase === 'loading' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Checking Databases...</span>
        </>
      )}
      {phase === 'starting' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>Starting Mathesar...</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take up to 90 seconds on first launch</span>
        </>
      )}
      {phase === 'error' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
          <span style={{ fontSize: 14 }}>Error with Databases</span>
          {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/office')} style={retryBtn}>Back to Office</button>
            <button onClick={() => { setError(null); checkAndStart(); }} style={{ ...retryBtn, background: '#a855f7', color: '#fff', border: 'none' }}>
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

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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Database, Loader2, AlertTriangle, Minimize2 } from 'lucide-react';
import { api } from '@/services/api';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<MathesarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deep-link: ?db=<id> → abrir esa base en la SPA (en vez de su home). Lo pone la rejilla
  // del launcher al clicar una tarjeta.
  const [searchParams] = useSearchParams();
  const dbParam = searchParams.get('db');

  // Dominio del sistema para abrir-en-pestaña-nueva la ruta del dash (no la URL del proxy).
  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  // Mathesar es una SPA con la base de routing horneada a "/" (no soporta subpath). Servida
  // bajo el subpath del iframe (/api/v1/databases/ui/) su router daría 404. Al cargar la
  // reencaminamos a su home "/" vía History API (los assets/API absolutos los sirven los
  // proxies de rutas-raíz de Core). El iframe es same-origin (proxy del dash) → accesible.
  const handleIframeLoad = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow;
      if (w && w.location.pathname.startsWith('/api/v1/databases/ui')) {
        const target = dbParam ? `/db/${encodeURIComponent(dbParam)}/` : '/';
        w.history.replaceState({}, '', target);
        w.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch { /* cross-origin (no debería: es proxy same-origin) */ }
  }, [dbParam]);

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
        {/* Header con controles. En fullscreen (abrir-en-pestaña ?fullscreen=1) se colapsa
            (height 0) → Mathesar ocupa toda la pestaña, igual que el editor Office. */}
        <div style={{
          height: fullscreen ? 0 : 36, overflow: 'hidden', display: 'flex', alignItems: 'center',
          padding: fullscreen ? 0 : '0 12px', borderBottom: fullscreen ? 'none' : '1px solid var(--border)',
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
            openUrl={`${dashOrigin}/office/databases?fullscreen=1`}
            fullscreen={fullscreen} onToggleFullscreen={toggle}
          />
        </div>
        <iframe
          ref={iframeRef}
          src={MATHESAR_UI}
          onLoad={handleIframeLoad}
          title="Mathesar Databases"
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
        {/* Salir de pantalla completa (visible solo en fullscreen; ESC también sale). */}
        <button
          onClick={toggle}
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

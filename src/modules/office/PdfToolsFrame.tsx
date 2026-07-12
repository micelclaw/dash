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

// ─── PDF Tools Frame ─────────────────────────────────────────────────
// Embeds Stirling PDF in a full-viewport iframe.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Wrench, Loader2, AlertTriangle, Minimize2 } from 'lucide-react';
import { api } from '@/services/api';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { useServiceUrl } from '@/config/service-urls';

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
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<StirlingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dominio del sistema para abrir-en-pestaña-nueva la ruta del dash (no la URL del proxy).
  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  // src del iframe: Stirling sirve su API en /api/v1/* ABSOLUTO → un proxy same-origin
  // chocaría con el /api/v1 de Core. Por eso se embebe por SUBDOMINIO (pdf.<dom>, ya
  // aprovisionado por system-domain con strip de X-Frame/CSP), alcanzable desde el móvil.
  // resolve → https://pdf.<dom> si está expuesto; si no (dev/sin dominio), el loopback status.url.
  const embedUrl = useServiceUrl('stirling-pdf', status?.url ?? '');

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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
        {/* En fullscreen (abrir-en-pestaña ?fullscreen=1) el header se colapsa → la app
            ocupa toda la pestaña, igual que el editor Office. */}
        <div style={{
          height: fullscreen ? 0 : 36, overflow: 'hidden', display: 'flex', alignItems: 'center',
          padding: fullscreen ? 0 : '0 12px', borderBottom: fullscreen ? 'none' : '1px solid var(--border)',
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
          <EmbedActions
            slug="stirling-pdf" fallbackUrl={embedUrl} ramMb={status.ram_mb}
            openUrl={`${dashOrigin}/office/pdf/tools?fullscreen=1`}
            fullscreen={fullscreen} onToggleFullscreen={toggle}
          />
        </div>
        <iframe
          src={embedUrl}
          title="Stirling PDF Tools"
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

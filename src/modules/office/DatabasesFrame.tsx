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
import { useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { OfficeErrorState } from './OfficeErrorState';
import { OFFICE_COLORS } from '@/config/office-colors';
import { api } from '@/services/api';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import {useI18n} from '@/i18n';

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
  const {t}=useI18n();const tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  const [phase, setPhase] = useState<Phase>('loading');
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
  // MAT7: el proxy de Core ya inyecta en el <head> del shell un replaceState a "/"
  // (así el SPA arranca en su home y no pinta el flash de "page doesn't exist"), así
  // que al llegar aquí el path puede estar YA limpio. Este handler sigue siendo
  // necesario para el deep-link ?db= — y como fallback si la inyección no ocurrió.
  const handleIframeLoad = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow;
      if (!w) return;
      const target = dbParam ? `/db/${encodeURIComponent(dbParam)}/` : '/';
      const pathname = w.location.pathname;
      if (pathname.startsWith('/api/v1/databases/ui') || pathname !== target) {
        w.history.replaceState({}, '', target);
        w.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch { /* cross-origin (no debería: es proxy same-origin) */ }
  }, [dbParam]);

  const checkAndStart = useCallback(async () => {
    try {
      const res = await api.get<{ data: MathesarStatus }>('/databases/status');
      const ms = res.data;

      if (ms.running) {
        setPhase('ready');
        return;
      }

      // Auto-start
      setPhase('starting');
      await api.post('/services/mathesar/start');

      // Poll until ready (Mathesar tarda: migraciones Django + 2 contenedores)
      let resolved = false;
      const poll = setInterval(async () => {
        try {
          const r2 = await api.get<{ data: MathesarStatus }>('/databases/status');
          const s2 = r2.data;
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
          setError(tRef.current('office.external.dbTimeout'));
          setPhase('error');
        }
      }, 150_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('office.external.dbCheckError'));
      setPhase('error');
    }
  }, []);

  useEffect(() => { checkAndStart(); }, [checkAndStart]);

  if (phase === 'ready') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
        <iframe
          ref={iframeRef}
          src={MATHESAR_UI}
          onLoad={handleIframeLoad}
          title={t('office.external.dbFrame')}
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
        <div data-embed-floating-actions style={{position:'absolute',top:8,right:8,zIndex:10,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'3px 8px',boxShadow:'0 1px 4px rgba(0,0,0,.28)'}}>
          <EmbedActions slug="mathesar" fallbackUrl={MATHESAR_UI}
            openUrl={`${dashOrigin}/office/databases?${new URLSearchParams({fullscreen:'1',...(dbParam?{db:dbParam}:{})})}`}
            fullscreen={fullscreen} onToggleFullscreen={toggle}/>
        </div>
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
          <span style={{ fontSize: 14 }}>{t('office.external.dbCheck')}</span>
        </>
      )}
      {phase === 'starting' && (
        <>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          <span style={{ fontSize: 14 }}>{t('office.external.dbStart')}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('office.external.dbFirst')}</span>
        </>
      )}
      {phase === 'error' && <OfficeErrorState title={t('office.external.dbError')} message={error??undefined}
        color={OFFICE_COLORS.databases} onRetry={()=>{setError(null);void checkAndStart();}} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

